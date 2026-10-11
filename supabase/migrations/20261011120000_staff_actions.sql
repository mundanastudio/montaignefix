-- ============================================================================
-- Montaigne Fix · Acciones del equipo
-- El técnico solo modifica incidencias asignadas a él. La comprobación está
-- en estas funciones, no en la pantalla. set_actor va en la misma transacción.
-- ============================================================================

create function montaigne_fix.assert_technician(p_actor uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
begin
  select name into v_name
  from montaigne_fix.staff
  where id = p_actor and active and is_technician;

  if v_name is null then
    raise exception 'MF: La sesión ha caducado. Vuelve a entrar.' using errcode = '42501';
  end if;

  perform montaigne_fix.set_actor(p_actor);
  return v_name;
end;
$$;

create function montaigne_fix.staff_list_tickets(p_actor uuid, p_tab text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_tab text := coalesce(nullif(btrim(p_tab), ''), 'mias');
  v_tickets jsonb;
begin
  perform montaigne_fix.assert_technician(p_actor);

  if v_tab not in ('mias', 'sin_asignar', 'todas') then
    raise exception 'MF: Esa pestaña no existe.';
  end if;

  select coalesce(jsonb_agg(item order by sort_priority, created_at), '[]'::jsonb)
  into v_tickets
  from (
    select
      case t.priority when 'p1' then 1 when 'p2' then 2 when 'p3' then 3 else 4 end as sort_priority,
      t.created_at,
      jsonb_build_object(
        'id', t.id,
        'code', t.code,
        'requesterName', t.requester_name,
        'description', case
          when char_length(t.description) > 180 then left(t.description, 177) || '…'
          else t.description
        end,
        'location', t.location,
        'status', t.status,
        'priority', t.priority,
        'assignee', s.name,
        'assigneeId', t.assigned_to,
        'mine', t.assigned_to = p_actor,
        'createdAt', t.created_at
      ) as item
    from montaigne_fix.tickets t
    left join montaigne_fix.staff s on s.id = t.assigned_to
    where v_tab = 'todas'
      or (v_tab = 'mias' and t.assigned_to = p_actor)
      or (
        v_tab = 'sin_asignar'
        and t.assigned_to is null
        and t.status not in ('cerrado', 'rechazado', 'duplicado')
      )
  ) listed;

  return jsonb_build_object(
    'tab', v_tab,
    'tabs', jsonb_build_object(
      'mias', (select count(*) from montaigne_fix.tickets where assigned_to = p_actor),
      'sinAsignar', (
        select count(*) from montaigne_fix.tickets
        where assigned_to is null and status not in ('cerrado', 'rechazado', 'duplicado')
      ),
      'todas', (select count(*) from montaigne_fix.tickets)
    ),
    'technicians', montaigne_fix.technician_options(),
    'tickets', v_tickets
  );
end;
$$;

create function montaigne_fix.staff_ticket_detail(p_actor uuid, p_code text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ticket montaigne_fix.tickets%rowtype;
  v_duplicate text;
  v_assignee text;
begin
  perform montaigne_fix.assert_technician(p_actor);

  select * into v_ticket
  from montaigne_fix.tickets
  where code = upper(btrim(coalesce(p_code, '')));

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  select name into v_assignee from montaigne_fix.staff where id = v_ticket.assigned_to;
  select code into v_duplicate from montaigne_fix.tickets where id = v_ticket.duplicate_of;

  return jsonb_build_object(
    'actorId', p_actor,
    'technicians', montaigne_fix.technician_options(),
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'code', v_ticket.code,
      'requesterName', v_ticket.requester_name,
      'requesterEmail', v_ticket.requester_email,
      'description', v_ticket.description,
      'location', v_ticket.location,
      'requesterNotes', v_ticket.requester_notes,
      'photoPath', v_ticket.photo_path,
      'status', v_ticket.status,
      'priority', v_ticket.priority,
      'assignee', v_assignee,
      'assigneeId', v_ticket.assigned_to,
      'mine', v_ticket.assigned_to = p_actor,
      'duplicateOf', v_duplicate,
      'createdAt', v_ticket.created_at,
      'assignedAt', v_ticket.assigned_at,
      'resolvedAt', v_ticket.resolved_at,
      'closedAt', v_ticket.closed_at
    ),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'kind', n.kind, 'body', n.body, 'author', a.name, 'createdAt', n.created_at
      ) order by n.created_at, n.id), '[]'::jsonb)
      from montaigne_fix.ticket_notes n
      join montaigne_fix.staff a on a.id = n.author_id
      where n.ticket_id = v_ticket.id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'type', e.event_type, 'actor', e.actor_label,
        'old', e.old_value, 'new', e.new_value, 'createdAt', e.created_at
      ) order by e.created_at, e.id), '[]'::jsonb)
      from montaigne_fix.ticket_events e
      where e.ticket_id = v_ticket.id
    ),
    'materials', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'status', i.status,
        'requestedBy', req.name,
        'requestedById', i.requested_by,
        'createdAt', i.created_at,
        'purchasedBy', buy.name,
        'purchasedAt', i.purchased_at
      ) order by case when i.status = 'pendiente' then 0 else 1 end, i.created_at), '[]'::jsonb)
      from montaigne_fix.shopping_items i
      join montaigne_fix.staff req on req.id = i.requested_by
      left join montaigne_fix.staff buy on buy.id = i.purchased_by
      where i.ticket_id = v_ticket.id
    )
  );
end;
$$;

create function montaigne_fix.lock_own_ticket(p_actor uuid, p_ticket uuid)
returns montaigne_fix.ticket_status
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status montaigne_fix.ticket_status;
  v_assigned uuid;
begin
  select status, assigned_to into v_status, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;
  if v_assigned is distinct from p_actor then
    raise exception 'MF: Solo puedes modificar las tareas que tienes asignadas.';
  end if;

  return v_status;
end;
$$;

create function montaigne_fix.staff_set_status(p_actor uuid, p_ticket uuid, p_status text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status montaigne_fix.ticket_status;
begin
  perform montaigne_fix.assert_technician(p_actor);
  v_status := montaigne_fix.lock_own_ticket(p_actor, p_ticket);

  if p_status not in ('en_curso', 'en_espera', 'resuelto') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;
  if v_status in ('cerrado', 'rechazado', 'duplicado') then
    raise exception 'MF: Esta incidencia ya está cerrada. Solo gerencia puede reabrirla.';
  end if;
  if v_status::text = p_status then
    return '{}'::jsonb;
  end if;

  update montaigne_fix.tickets
  set status = p_status::montaigne_fix.ticket_status
  where id = p_ticket;

  return '{}'::jsonb;
end;
$$;

create function montaigne_fix.staff_add_note(p_actor uuid, p_ticket uuid, p_body text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  perform montaigne_fix.assert_technician(p_actor);
  perform montaigne_fix.lock_own_ticket(p_actor, p_ticket);

  if v_body = '' then
    raise exception 'MF: Escribe la observación.';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'MF: La observación no puede pasar de 2000 caracteres.';
  end if;

  insert into montaigne_fix.ticket_notes (ticket_id, kind, author_id, body)
  values (p_ticket, 'interna', p_actor, v_body);

  return '{}'::jsonb;
end;
$$;

create function montaigne_fix.staff_assign(p_actor uuid, p_ticket uuid, p_mode text, p_staff uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status montaigne_fix.ticket_status;
  v_assigned uuid;
begin
  perform montaigne_fix.assert_technician(p_actor);

  select status, assigned_to into v_status, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  if p_mode = 'tomar' then
    if v_assigned = p_actor then
      return '{}'::jsonb;
    end if;
    if v_assigned is not null then
      raise exception 'MF: Esa incidencia ya tiene técnico.';
    end if;
    if v_status in ('cerrado', 'rechazado', 'duplicado') then
      raise exception 'MF: Esta incidencia ya está cerrada.';
    end if;
    update montaigne_fix.tickets set assigned_to = p_actor where id = p_ticket;
    return '{}'::jsonb;
  end if;

  if p_mode = 'soltar' then
    if v_assigned is distinct from p_actor then
      raise exception 'MF: Solo puedes quitarte una tarea que sea tuya.';
    end if;
    update montaigne_fix.tickets set assigned_to = null where id = p_ticket;
    return '{}'::jsonb;
  end if;

  if p_mode = 'reasignar' then
    if v_assigned is distinct from p_actor then
      raise exception 'MF: Solo puedes pasar una tarea que sea tuya.';
    end if;
    if p_staff is null or p_staff = p_actor then
      raise exception 'MF: Elige a otro compañero.';
    end if;
    if not exists (
      select 1 from montaigne_fix.staff
      where id = p_staff and active and is_technician
    ) then
      raise exception 'MF: Solo se puede asignar a Fran, Agustín o Andrés.';
    end if;
    update montaigne_fix.tickets set assigned_to = p_staff where id = p_ticket;
    return '{}'::jsonb;
  end if;

  raise exception 'MF: Esa asignación no está permitida.';
end;
$$;

create function montaigne_fix.staff_add_materials(p_actor uuid, p_ticket uuid, p_lines text[])
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_line text;
  v_added int := 0;
begin
  v_name := montaigne_fix.assert_technician(p_actor);
  perform montaigne_fix.lock_own_ticket(p_actor, p_ticket);

  if p_lines is null or cardinality(p_lines) = 0 then
    raise exception 'MF: Escribe al menos un artículo, uno por línea.';
  end if;
  if cardinality(p_lines) > 40 then
    raise exception 'MF: Puedes enviar hasta 40 artículos a la vez.';
  end if;

  foreach v_line in array p_lines loop
    v_line := btrim(coalesce(v_line, ''));
    if v_line = '' then
      continue;
    end if;
    if char_length(v_line) > 200 then
      raise exception 'MF: Cada artículo puede tener como máximo 200 caracteres.';
    end if;

    insert into montaigne_fix.shopping_items (ticket_id, description, requested_by)
    values (p_ticket, v_line, p_actor);

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'material_solicitado', p_actor, v_name, v_line);

    v_added := v_added + 1;
  end loop;

  if v_added = 0 then
    raise exception 'MF: Escribe al menos un artículo, uno por línea.';
  end if;

  return '{}'::jsonb;
end;
$$;

create function montaigne_fix.staff_delete_material(p_actor uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
begin
  v_name := montaigne_fix.assert_technician(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' or v_item.requested_by is distinct from p_actor then
    raise exception 'MF: Solo puedes borrar un material que hayas pedido tú y que siga pendiente.';
  end if;

  perform montaigne_fix.lock_own_ticket(p_actor, v_item.ticket_id);

  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value)
  values (v_item.ticket_id, 'material_borrado', p_actor, v_name, v_item.description);

  delete from montaigne_fix.shopping_items where id = p_id and status = 'pendiente' and requested_by = p_actor;

  return '{}'::jsonb;
end;
$$;

revoke all on all functions in schema montaigne_fix from public, anon, authenticated;
grant execute on all functions in schema montaigne_fix to service_role;
