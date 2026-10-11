-- ============================================================================
-- Montaigne Fix · Acciones de gerencia
-- set_actor solo vive dentro de la transacción. Estas funciones hacen el cambio
-- y dejan el historial en el mismo sitio. Las Edge Functions admin-* las llaman.
-- ============================================================================

create function montaigne_fix.assert_manager(p_actor uuid)
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
  where id = p_actor and active and is_manager;

  if v_name is null then
    raise exception 'MF: La sesión ha caducado. Vuelve a entrar.' using errcode = '42501';
  end if;

  perform montaigne_fix.set_actor(p_actor);
  return v_name;
end;
$$;

create function montaigne_fix.ticket_counts()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'nuevas', (select count(*) from montaigne_fix.tickets where status = 'nuevo'),
    'p1Abiertas', (
      select count(*) from montaigne_fix.tickets
      where priority = 'p1' and status not in ('cerrado', 'rechazado', 'duplicado')
    ),
    'resueltas', (select count(*) from montaigne_fix.tickets where status = 'resuelto'),
    'pendientesCompra', (select count(*) from montaigne_fix.shopping_items where status = 'pendiente')
  );
$$;

create function montaigne_fix.technician_options()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'slug', slug, 'name', name)
      order by array_position(array['fran', 'agustin', 'andres'], slug), name
    ),
    '[]'::jsonb
  )
  from montaigne_fix.staff
  where active and is_technician;
$$;

create function montaigne_fix.admin_counts(p_actor uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform montaigne_fix.assert_manager(p_actor);
  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_list_tickets(
  p_actor uuid,
  p_status text,
  p_priority text,
  p_assigned text,
  p_from date,
  p_to date,
  p_query text
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_priority text := nullif(btrim(coalesce(p_priority, '')), '');
  v_assigned text := nullif(btrim(coalesce(p_assigned, '')), '');
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_assignee uuid;
  v_tickets jsonb;
begin
  perform montaigne_fix.assert_manager(p_actor);

  if v_status is not null and v_status not in (
    'nuevo', 'asignado', 'en_curso', 'en_espera', 'resuelto', 'cerrado', 'rechazado', 'duplicado'
  ) then
    raise exception 'MF: El estado no es válido.';
  end if;

  if v_priority is not null and v_priority not in ('p1', 'p2', 'p3', 'ninguna') then
    raise exception 'MF: La prioridad no es válida.';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'MF: La fecha inicial no puede ser posterior a la final.';
  end if;

  if v_assigned = 'ninguno' then
    v_assignee := null;
  elsif v_assigned is not null then
    begin
      v_assignee := v_assigned::uuid;
    exception when invalid_text_representation then
      raise exception 'MF: La persona asignada no es válida.';
    end;
  end if;

  if v_query is not null then
    if char_length(v_query) > 100 then
      raise exception 'MF: La búsqueda es demasiado larga.';
    end if;
    v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
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
        'createdAt', t.created_at
      ) as item
    from montaigne_fix.tickets t
    left join montaigne_fix.staff s on s.id = t.assigned_to
    where (v_status is null or t.status::text = v_status)
      and (
        v_priority is null
        or (v_priority = 'ninguna' and t.priority is null)
        or t.priority::text = v_priority
      )
      and (
        v_assigned is null
        or (v_assigned = 'ninguno' and t.assigned_to is null)
        or t.assigned_to = v_assignee
      )
      and (p_from is null or (t.created_at at time zone 'Europe/Madrid')::date >= p_from)
      and (p_to is null or (t.created_at at time zone 'Europe/Madrid')::date <= p_to)
      and (
        v_query is null
        or t.code ilike '%' || v_query || '%' escape '\'
        or t.requester_name ilike '%' || v_query || '%' escape '\'
        or t.description ilike '%' || v_query || '%' escape '\'
        or t.location ilike '%' || v_query || '%' escape '\'
      )
  ) listed;

  return jsonb_build_object(
    'counts', montaigne_fix.ticket_counts(),
    'technicians', montaigne_fix.technician_options(),
    'tickets', v_tickets
  );
end;
$$;

create function montaigne_fix.admin_ticket_detail(p_actor uuid, p_code text)
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
  perform montaigne_fix.assert_manager(p_actor);

  select * into v_ticket
  from montaigne_fix.tickets
  where code = upper(btrim(coalesce(p_code, '')));

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  select name into v_assignee from montaigne_fix.staff where id = v_ticket.assigned_to;
  select code into v_duplicate from montaigne_fix.tickets where id = v_ticket.duplicate_of;

  return jsonb_build_object(
    'counts', montaigne_fix.ticket_counts(),
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
      'duplicateOf', v_duplicate,
      'createdAt', v_ticket.created_at,
      'assignedAt', v_ticket.assigned_at,
      'resolvedAt', v_ticket.resolved_at,
      'closedAt', v_ticket.closed_at
    ),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id,
        'kind', n.kind,
        'body', n.body,
        'author', a.name,
        'createdAt', n.created_at
      ) order by n.created_at, n.id), '[]'::jsonb)
      from montaigne_fix.ticket_notes n
      join montaigne_fix.staff a on a.id = n.author_id
      where n.ticket_id = v_ticket.id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'type', e.event_type,
        'actor', e.actor_label,
        'old', e.old_value,
        'new', e.new_value,
        'createdAt', e.created_at
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

create function montaigne_fix.require_ticket(p_ticket uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (select 1 from montaigne_fix.tickets where id = p_ticket) then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;
end;
$$;

create function montaigne_fix.admin_set_priority(p_actor uuid, p_ticket uuid, p_priority text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform montaigne_fix.assert_manager(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

  if p_priority not in ('p1', 'p2', 'p3') then
    raise exception 'MF: Elige P1, P2 o P3.';
  end if;

  update montaigne_fix.tickets
  set priority = p_priority::montaigne_fix.ticket_priority
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_set_status(
  p_actor uuid,
  p_ticket uuid,
  p_status text,
  p_duplicate_code text
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_current montaigne_fix.ticket_status;
  v_assigned uuid;
  v_other uuid;
  v_next montaigne_fix.ticket_status;
begin
  perform montaigne_fix.assert_manager(p_actor);

  select status, assigned_to into v_current, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  if p_status = 'reabrir' then
    if v_current not in ('cerrado', 'rechazado', 'duplicado') then
      raise exception 'MF: Solo se reabre una incidencia cerrada, rechazada o duplicada.';
    end if;
    v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    update montaigne_fix.tickets set status = v_next where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'cerrado' then
    if v_current <> 'resuelto' then
      raise exception 'MF: Solo se cierra una incidencia resuelta.';
    end if;
    update montaigne_fix.tickets set status = 'cerrado' where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'duplicado' then
    select id into v_other
    from montaigne_fix.tickets
    where code = upper(btrim(coalesce(p_duplicate_code, '')));

    if v_other is null then
      raise exception 'MF: No encontramos la incidencia original.';
    end if;
    if v_other = p_ticket then
      raise exception 'MF: Una incidencia no puede ser duplicado de sí misma.';
    end if;

    update montaigne_fix.tickets
    set status = 'duplicado', duplicate_of = v_other
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status not in ('en_curso', 'en_espera', 'resuelto', 'rechazado') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;

  if v_current in ('cerrado', 'rechazado', 'duplicado') and p_status <> 'rechazado' then
    raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
  end if;

  if v_current::text = p_status then
    return montaigne_fix.ticket_counts();
  end if;

  update montaigne_fix.tickets
  set status = p_status::montaigne_fix.ticket_status
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_assign(p_actor uuid, p_ticket uuid, p_staff uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform montaigne_fix.assert_manager(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

  if p_staff is not null and not exists (
    select 1 from montaigne_fix.staff
    where id = p_staff and active and is_technician
  ) then
    raise exception 'MF: Solo se puede asignar a Fran, Agustín o Andrés.';
  end if;

  update montaigne_fix.tickets
  set assigned_to = p_staff
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_add_note(p_actor uuid, p_ticket uuid, p_body text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  perform montaigne_fix.assert_manager(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

  if v_body = '' then
    raise exception 'MF: Escribe la observación.';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'MF: La observación no puede pasar de 2000 caracteres.';
  end if;

  insert into montaigne_fix.ticket_notes (ticket_id, kind, author_id, body)
  values (p_ticket, 'gestion', p_actor, v_body);

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_add_materials(p_actor uuid, p_ticket uuid, p_lines text[])
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
  v_name := montaigne_fix.assert_manager(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

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

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_mark_purchased(p_actor uuid, p_ids uuid[])
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item record;
  v_changed int := 0;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'MF: Selecciona al menos un artículo.';
  end if;
  if cardinality(p_ids) > 100 then
    raise exception 'MF: Puedes marcar hasta 100 artículos a la vez.';
  end if;

  for v_item in
    update montaigne_fix.shopping_items
    set status = 'comprado', purchased_by = p_actor, purchased_at = now()
    where id = any (p_ids) and status = 'pendiente'
    returning id, ticket_id, description
  loop
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (v_item.ticket_id, 'material_comprado', p_actor, v_name, 'pendiente', v_item.description);
    v_changed := v_changed + 1;
  end loop;

  return montaigne_fix.ticket_counts() || jsonb_build_object('changed', v_changed);
end;
$$;

create function montaigne_fix.admin_unmark_purchased(p_actor uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'comprado' then
    raise exception 'MF: Ese artículo no está comprado.';
  end if;
  if v_item.purchased_at < now() - interval '30 days' then
    raise exception 'MF: Solo se puede deshacer una compra de los últimos 30 días.';
  end if;

  update montaigne_fix.shopping_items
  set status = 'pendiente', purchased_by = null, purchased_at = null
  where id = p_id;

  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
  values (v_item.ticket_id, 'material_repuesto', p_actor, v_name, v_item.description, 'pendiente');

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_delete_material(p_actor uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' then
    raise exception 'MF: Solo se puede borrar un artículo que siga pendiente.';
  end if;

  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value)
  values (v_item.ticket_id, 'material_borrado', p_actor, v_name, v_item.description);

  delete from montaigne_fix.shopping_items where id = p_id and status = 'pendiente';

  return montaigne_fix.ticket_counts();
end;
$$;

create function montaigne_fix.admin_shopping_list(p_actor uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform montaigne_fix.assert_manager(p_actor);

  return jsonb_build_object(
    'counts', montaigne_fix.ticket_counts(),
    'pending', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'requestedBy', req.name,
        'createdAt', i.created_at,
        'ticketId', t.id,
        'code', t.code,
        'repair', t.description,
        'location', t.location
      ) order by t.code, i.created_at), '[]'::jsonb)
      from montaigne_fix.shopping_items i
      join montaigne_fix.tickets t on t.id = i.ticket_id
      join montaigne_fix.staff req on req.id = i.requested_by
      where i.status = 'pendiente'
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'requestedBy', req.name,
        'purchasedBy', buy.name,
        'purchasedAt', i.purchased_at,
        'code', t.code,
        'repair', t.description,
        'location', t.location
      ) order by i.purchased_at desc), '[]'::jsonb)
      from montaigne_fix.shopping_items i
      join montaigne_fix.tickets t on t.id = i.ticket_id
      join montaigne_fix.staff req on req.id = i.requested_by
      left join montaigne_fix.staff buy on buy.id = i.purchased_by
      where i.status = 'comprado'
        and i.purchased_at >= now() - interval '30 days'
    )
  );
end;
$$;

revoke all on all functions in schema montaigne_fix from public, anon, authenticated;
grant execute on all functions in schema montaigne_fix to service_role;
