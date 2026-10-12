-- Funciones de fotos. No toca assert_manager ni assert_technician:
-- assert_photo_actor las llama según el panel (p_as_manager).

create function montaigne_fix.assert_photo_actor(p_actor uuid, p_as_manager boolean)
returns text
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_as_manager then
    return montaigne_fix.assert_manager(p_actor);
  end if;
  return montaigne_fix.assert_technician(p_actor);
end;
$$;

create function montaigne_fix.photo_path_allowed(p_ticket uuid, p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_path is not null
    and p_path = btrim(p_path)
    and p_path like p_ticket::text || '/%'
    and char_length(p_path) > char_length(p_ticket::text) + 1
    and position('..' in p_path) = 0;
$$;

create function montaigne_fix.ticket_photo_paths(p_ticket uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct path), '{}')
  from (
    select p.path
    from montaigne_fix.ticket_photos p
    where p.ticket_id = p_ticket
    union
    select t.photo_path
    from montaigne_fix.tickets t
    where t.id = p_ticket
      and t.photo_path is not null
      and btrim(t.photo_path) <> ''
    union
    select o.name
    from storage.objects o
    where o.bucket_id = 'montaigne-fix-fotos'
      and (
        o.name like p_ticket::text || '/%'
        or o.name = p_ticket::text || '.jpg'
      )
  ) s
  where path is not null and btrim(path) <> '';
$$;

create function montaigne_fix.ticket_photos_json(p_ticket uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'path', p.path,
    'sortOrder', p.sort_order,
    'uploadedBy', coalesce(s.name, 'Solicitante'),
    'uploadedById', p.uploaded_by,
    'createdAt', p.created_at
  ) order by p.sort_order, p.created_at), '[]'::jsonb)
  from montaigne_fix.ticket_photos p
  left join montaigne_fix.staff s on s.id = p.uploaded_by
  where p.ticket_id = p_ticket;
$$;

create function montaigne_fix.add_ticket_photos(
  p_actor uuid,
  p_ticket uuid,
  p_paths text[],
  p_as_manager boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_path text;
  v_order int;
  v_added int := 0;
begin
  v_name := montaigne_fix.assert_photo_actor(p_actor, p_as_manager);
  perform montaigne_fix.require_ticket(p_ticket);
  perform 1 from montaigne_fix.tickets where id = p_ticket for update;

  if p_paths is null or cardinality(p_paths) = 0 then
    raise exception 'MF: Añade al menos una foto.';
  end if;

  select count(*), coalesce(max(sort_order), 0)
    into v_added, v_order
  from montaigne_fix.ticket_photos
  where ticket_id = p_ticket;
  if v_added + cardinality(p_paths) > 10 then
    raise exception 'MF: Este parte ya tiene 10 fotos.';
  end if;
  v_added := 0;

  foreach v_path in array p_paths loop
    v_path := btrim(coalesce(v_path, ''));
    if v_path = '' then
      continue;
    end if;
    if not montaigne_fix.photo_path_allowed(p_ticket, v_path) then
      raise exception 'MF: Esa foto no pertenece a este parte.';
    end if;
    v_order := v_order + 1;
    insert into montaigne_fix.ticket_photos (ticket_id, path, sort_order, uploaded_by)
    values (p_ticket, v_path, v_order, p_actor);
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'foto_anadida', p_actor, v_name, v_path);
    v_added := v_added + 1;
  end loop;

  if v_added = 0 then
    raise exception 'MF: Añade al menos una foto.';
  end if;
  return jsonb_build_object('added', v_added);
end;
$$;

create function montaigne_fix.insert_requester_photos(p_ticket uuid, p_paths text[])
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_path text;
  v_order int;
  v_added int := 0;
begin
  perform montaigne_fix.require_ticket(p_ticket);
  perform 1 from montaigne_fix.tickets where id = p_ticket for update;
  select coalesce(max(sort_order), 0) into v_order from montaigne_fix.ticket_photos where ticket_id = p_ticket;

  if p_paths is null or cardinality(p_paths) = 0 then
    return jsonb_build_object('added', 0);
  end if;
  if cardinality(p_paths) > 3 then
    raise exception 'MF: Puedes enviar como máximo 3 fotos.';
  end if;

  foreach v_path in array p_paths loop
    v_path := btrim(coalesce(v_path, ''));
    if v_path = '' then
      continue;
    end if;
    if not montaigne_fix.photo_path_allowed(p_ticket, v_path) then
      raise exception 'MF: Esa foto no pertenece a este parte.';
    end if;
    v_order := v_order + 1;
    insert into montaigne_fix.ticket_photos (ticket_id, path, sort_order, uploaded_by)
    values (p_ticket, v_path, v_order, null);
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('added', v_added);
end;
$$;

create function montaigne_fix.delete_ticket_photo(
  p_actor uuid,
  p_photo uuid,
  p_as_manager boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_row montaigne_fix.ticket_photos%rowtype;
begin
  v_name := montaigne_fix.assert_photo_actor(p_actor, p_as_manager);

  select * into v_row from montaigne_fix.ticket_photos where id = p_photo for update;
  if not found then
    raise exception 'MF: No encontramos esa foto.' using errcode = 'P0002';
  end if;

  if not p_as_manager and v_row.uploaded_by is distinct from p_actor then
    raise exception 'MF: Solo puedes borrar las fotos que has subido tú. Las del solicitante las borra gestión.';
  end if;

  delete from montaigne_fix.ticket_photos where id = p_photo;
  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value)
  values (v_row.ticket_id, 'foto_borrada', p_actor, v_name, v_row.path);

  return jsonb_build_object('photoPath', v_row.path, 'ticketId', v_row.ticket_id);
end;
$$;

create or replace function montaigne_fix.admin_delete_ticket(p_actor uuid, p_ticket uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform montaigne_fix.assert_manager(p_actor);
  perform 1 from montaigne_fix.tickets where id = p_ticket for update;
  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  delete from montaigne_fix.email_log where ticket_id = p_ticket;
  delete from montaigne_fix.tickets where id = p_ticket;

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

revoke all on function montaigne_fix.assert_photo_actor(uuid, boolean) from public, anon, authenticated;
revoke all on function montaigne_fix.photo_path_allowed(uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.ticket_photo_paths(uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.ticket_photos_json(uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.add_ticket_photos(uuid, uuid, text[], boolean) from public, anon, authenticated;
revoke all on function montaigne_fix.insert_requester_photos(uuid, text[]) from public, anon, authenticated;
revoke all on function montaigne_fix.delete_ticket_photo(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_delete_ticket(uuid, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_ticket_detail(uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_ticket_detail(uuid, text) from public, anon, authenticated;

grant execute on function montaigne_fix.assert_photo_actor(uuid, boolean) to service_role;
grant execute on function montaigne_fix.photo_path_allowed(uuid, text) to service_role;
grant execute on function montaigne_fix.ticket_photo_paths(uuid) to service_role;
grant execute on function montaigne_fix.ticket_photos_json(uuid) to service_role;
grant execute on function montaigne_fix.add_ticket_photos(uuid, uuid, text[], boolean) to service_role;
grant execute on function montaigne_fix.insert_requester_photos(uuid, text[]) to service_role;
grant execute on function montaigne_fix.delete_ticket_photo(uuid, uuid, boolean) to service_role;
grant execute on function montaigne_fix.admin_delete_ticket(uuid, uuid) to service_role;
grant execute on function montaigne_fix.admin_ticket_detail(uuid, text) to service_role;
grant execute on function montaigne_fix.staff_ticket_detail(uuid, text) to service_role;
