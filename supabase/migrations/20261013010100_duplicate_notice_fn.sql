-- Duplicado: original abierto, historial, ficha, Equipo no los ve, quitar duplicado.

create function montaigne_fix.linked_duplicates_json(p_ticket uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', t.code,
    'description', t.description,
    'location', t.location
  ) order by t.code), '[]'::jsonb)
  from montaigne_fix.tickets t
  where t.duplicate_of = p_ticket;
$$;

create function montaigne_fix.open_ticket_choices_json(p_except uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', t.code,
    'description', t.description,
    'location', t.location
  ) order by t.code), '[]'::jsonb)
  from montaigne_fix.tickets t
  where t.id is distinct from p_except
    and t.status not in ('cerrado', 'rechazado', 'duplicado');
$$;

create or replace function montaigne_fix.admin_set_status(
  p_actor uuid,
  p_ticket uuid,
  p_status text,
  p_duplicate_code text,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_current montaigne_fix.ticket_status;
  v_assigned uuid;
  v_other uuid;
  v_other_status montaigne_fix.ticket_status;
  v_next montaigne_fix.ticket_status;
  v_prev text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original text;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select status, assigned_to into v_current, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  if p_status = 'quitar_duplicado' then
    if v_current <> 'duplicado' then
      raise exception 'MF: Esa incidencia no está marcada como duplicado.';
    end if;
    select e.old_value into v_prev
    from montaigne_fix.ticket_events e
    where e.ticket_id = p_ticket
      and e.event_type = 'estado'
      and e.new_value = 'duplicado'
    order by e.created_at desc, e.id desc
    limit 1;
    if v_prev in ('nuevo', 'asignado', 'en_curso', 'en_espera', 'resuelto', 'cerrado', 'rechazado') then
      v_next := v_prev::montaigne_fix.ticket_status;
    else
      v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    end if;
    update montaigne_fix.tickets
    set status = v_next, rejection_reason = case when v_next = 'rechazado' then rejection_reason else null end
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'reabrir' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current not in ('cerrado', 'rechazado') then
      raise exception 'MF: Solo se reabre una incidencia cerrada o rechazada.';
    end if;
    v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    update montaigne_fix.tickets
    set status = v_next, rejection_reason = null
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'cerrado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current = 'rechazado' then
      raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
    end if;
    if v_current <> 'cerrado' then
      update montaigne_fix.tickets set status = 'cerrado' where id = p_ticket;
    end if;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'duplicado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current in ('cerrado', 'rechazado') then
      raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
    end if;
    v_original := upper(btrim(coalesce(p_duplicate_code, '')));
    if v_original = '' then
      raise exception 'MF: Elige el parte original al que unirlo.';
    end if;

    select id, status into v_other, v_other_status
    from montaigne_fix.tickets
    where code = v_original;

    if v_other is null then
      raise exception 'MF: No encontramos la incidencia original.';
    end if;
    if v_other = p_ticket then
      raise exception 'MF: Una incidencia no puede ser duplicado de sí misma.';
    end if;
    if v_other_status in ('cerrado', 'rechazado', 'duplicado') then
      raise exception 'MF: El parte original tiene que estar abierto.';
    end if;

    update montaigne_fix.tickets
    set status = 'duplicado', duplicate_of = v_other, rejection_reason = null
    where id = p_ticket;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'duplicado', p_actor, v_name, v_original);

    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'rechazado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
      raise exception 'MF: Escribe el motivo del rechazo (entre 10 y 500 caracteres).';
    end if;

    update montaigne_fix.tickets
    set status = 'rechazado', rejection_reason = v_reason
    where id = p_ticket;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'rechazo', p_actor, v_name, v_reason);

    return montaigne_fix.ticket_counts();
  end if;

  if p_status not in ('en_curso', 'en_espera', 'resuelto') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;

  if v_current = 'duplicado' then
    raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
  end if;
  if v_current in ('cerrado', 'rechazado') then
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

create or replace function montaigne_fix.admin_ticket_detail(p_actor uuid, p_code text)
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
      'status', v_ticket.status,
      'priority', v_ticket.priority,
      'assignee', v_assignee,
      'assigneeId', v_ticket.assigned_to,
      'duplicateOf', v_duplicate,
      'rejectionReason', v_ticket.rejection_reason,
      'createdAt', v_ticket.created_at,
      'assignedAt', v_ticket.assigned_at,
      'resolvedAt', v_ticket.resolved_at,
      'closedAt', v_ticket.closed_at
    ),
    'linkedDuplicates', montaigne_fix.linked_duplicates_json(v_ticket.id),
    'openTickets', montaigne_fix.open_ticket_choices_json(v_ticket.id),
    'photos', montaigne_fix.ticket_photos_json(v_ticket.id),
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

create or replace function montaigne_fix.staff_ticket_detail(p_actor uuid, p_code text)
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
      'status', v_ticket.status,
      'priority', v_ticket.priority,
      'assignee', v_assignee,
      'assigneeId', v_ticket.assigned_to,
      'mine', v_ticket.assigned_to = p_actor,
      'duplicateOf', v_duplicate,
      'rejectionReason', v_ticket.rejection_reason,
      'createdAt', v_ticket.created_at,
      'assignedAt', v_ticket.assigned_at,
      'resolvedAt', v_ticket.resolved_at,
      'closedAt', v_ticket.closed_at
    ),
    'linkedDuplicates', montaigne_fix.linked_duplicates_json(v_ticket.id),
    'photos', montaigne_fix.ticket_photos_json(v_ticket.id),
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

create or replace function montaigne_fix.staff_list_tickets(p_actor uuid, p_tab text)
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
        'description', t.description,
        'notes', nullif(btrim(t.requester_notes), ''),
        'location', t.location,
        'status', t.status,
        'priority', t.priority,
        'assignee', s.name,
        'mine', t.assigned_to = p_actor,
        'createdAt', t.created_at,
        'materials', coalesce((
          select jsonb_agg(
            jsonb_build_object('description', m.description, 'status', m.status)
            order by m.created_at
          )
          from montaigne_fix.shopping_items m
          where m.ticket_id = t.id
        ), '[]'::jsonb)
      ) as item
    from montaigne_fix.tickets t
    left join montaigne_fix.staff s on s.id = t.assigned_to
    where t.status <> 'duplicado'
      and (
        v_tab = 'todas'
        or (v_tab = 'mias' and t.assigned_to = p_actor)
        or (
          v_tab = 'sin_asignar'
          and t.assigned_to is null
          and t.status not in ('cerrado', 'rechazado')
        )
      )
  ) listed;

  return jsonb_build_object(
    'tab', v_tab,
    'tabs', jsonb_build_object(
      'mias', (
        select count(*) from montaigne_fix.tickets
        where assigned_to = p_actor and status <> 'duplicado'
      ),
      'sinAsignar', (
        select count(*) from montaigne_fix.tickets
        where assigned_to is null and status not in ('cerrado', 'rechazado', 'duplicado')
      ),
      'todas', (
        select count(*) from montaigne_fix.tickets where status <> 'duplicado'
      )
    ),
    'technicians', montaigne_fix.technician_options(),
    'tickets', v_tickets
  );
end;
$$;

revoke all on function montaigne_fix.linked_duplicates_json(uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.open_ticket_choices_json(uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_set_status(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_ticket_detail(uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_ticket_detail(uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_list_tickets(uuid, text) from public, anon, authenticated;

grant execute on function montaigne_fix.linked_duplicates_json(uuid) to service_role;
grant execute on function montaigne_fix.open_ticket_choices_json(uuid) to service_role;
grant execute on function montaigne_fix.admin_set_status(uuid, uuid, text, text, text) to service_role;
grant execute on function montaigne_fix.admin_ticket_detail(uuid, text) to service_role;
grant execute on function montaigne_fix.staff_ticket_detail(uuid, text) to service_role;
grant execute on function montaigne_fix.staff_list_tickets(uuid, text) to service_role;
