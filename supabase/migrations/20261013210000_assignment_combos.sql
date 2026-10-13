-- Equipos de asignación (solo Gestión los elige). Equipo los ve y puede trabajarlos
-- si sale en el combo; no puede asignarse un combo ni elegirlos en el PIN.

alter table montaigne_fix.staff
  add column if not exists is_combo boolean not null default false,
  add column if not exists combo_members text[];

alter table montaigne_fix.staff drop constraint if exists staff_combo_shape;
alter table montaigne_fix.staff add constraint staff_combo_shape check (
  (not is_combo and combo_members is null)
  or (
    is_combo
    and is_technician
    and not is_manager
    and combo_members is not null
    and cardinality(combo_members) between 2 and 3
  )
);

insert into montaigne_fix.staff (slug, name, full_name, email, is_manager, is_technician, is_combo, combo_members)
values
  ('fran-agustin', 'Fran+Agustín', null, null, false, true, true, array['fran', 'agustin']::text[]),
  ('fran-andres', 'Fran+Andrés', null, null, false, true, true, array['fran', 'andres']::text[]),
  ('agustin-andres', 'Agustín+Andrés', null, null, false, true, true, array['agustin', 'andres']::text[]),
  ('fran-agustin-andres', 'Fran+Agustín+Andrés', null, null, false, true, true, array['fran', 'agustin', 'andres']::text[])
on conflict (slug) do update
set name = excluded.name,
    is_manager = excluded.is_manager,
    is_technician = excluded.is_technician,
    is_combo = excluded.is_combo,
    combo_members = excluded.combo_members;

create or replace function montaigne_fix.assignment_includes(p_assigned uuid, p_actor uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    p_assigned is not null
    and (
      p_assigned = p_actor
      or exists (
        select 1
        from montaigne_fix.staff combo
        join montaigne_fix.staff actor on actor.id = p_actor
        where combo.id = p_assigned
          and combo.is_combo
          and actor.slug = any (combo.combo_members)
      )
    );
$$;

create or replace function montaigne_fix.technician_options()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'slug', slug, 'name', name, 'combo', is_combo)
      order by
        array_position(
          array[
            'fran', 'agustin', 'andres',
            'fran-agustin', 'fran-andres', 'agustin-andres', 'fran-agustin-andres'
          ],
          slug
        ),
        name
    ),
    '[]'::jsonb
  )
  from montaigne_fix.staff
  where active and is_technician;
$$;

create or replace function montaigne_fix.team_technician_options()
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
  where active and is_technician and not is_combo;
$$;

create or replace function montaigne_fix.assert_technician(p_actor uuid)
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
  where id = p_actor and active and is_technician and not is_combo;

  if v_name is null then
    raise exception 'MF: La sesión ha caducado. Vuelve a entrar.' using errcode = '42501';
  end if;

  perform montaigne_fix.set_actor(p_actor);
  return v_name;
end;
$$;

create or replace function montaigne_fix.lock_own_ticket(p_actor uuid, p_ticket uuid)
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
  if not montaigne_fix.assignment_includes(v_assigned, p_actor) then
    raise exception 'MF: Solo puedes modificar las tareas que tienes asignadas.';
  end if;

  return v_status;
end;
$$;

create or replace function montaigne_fix.admin_assign(p_actor uuid, p_ticket uuid, p_staff uuid)
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
    raise exception 'MF: Solo se puede asignar a Fran, Agustín, Andrés o un equipo.';
  end if;

  update montaigne_fix.tickets
  set assigned_to = p_staff
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

create or replace function montaigne_fix.staff_assign(p_actor uuid, p_ticket uuid, p_mode text, p_staff uuid)
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
      where id = p_staff and active and is_technician and not is_combo
    ) then
      raise exception 'MF: Solo se puede asignar a Fran, Agustín o Andrés.';
    end if;
    update montaigne_fix.tickets set assigned_to = p_staff where id = p_ticket;
    return '{}'::jsonb;
  end if;

  raise exception 'MF: Esa asignación no está permitida.';
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
    'technicians', montaigne_fix.team_technician_options(),
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
      'mine', montaigne_fix.assignment_includes(v_ticket.assigned_to, p_actor),
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
        'mine', montaigne_fix.assignment_includes(t.assigned_to, p_actor),
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
        or (v_tab = 'mias' and montaigne_fix.assignment_includes(t.assigned_to, p_actor))
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
        where montaigne_fix.assignment_includes(assigned_to, p_actor) and status <> 'duplicado'
      ),
      'sinAsignar', (
        select count(*) from montaigne_fix.tickets
        where assigned_to is null and status not in ('cerrado', 'rechazado', 'duplicado')
      ),
      'todas', (
        select count(*) from montaigne_fix.tickets where status <> 'duplicado'
      )
    ),
    'technicians', montaigne_fix.team_technician_options(),
    'tickets', v_tickets
  );
end;
$$;

revoke all on function montaigne_fix.assignment_includes(uuid, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.technician_options() from public, anon, authenticated;
revoke all on function montaigne_fix.team_technician_options() from public, anon, authenticated;
revoke all on function montaigne_fix.assert_technician(uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.lock_own_ticket(uuid, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_assign(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_assign(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_ticket_detail(uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_list_tickets(uuid, text) from public, anon, authenticated;
grant execute on function montaigne_fix.assignment_includes(uuid, uuid) to service_role;
grant execute on function montaigne_fix.technician_options() to service_role;
grant execute on function montaigne_fix.team_technician_options() to service_role;
grant execute on function montaigne_fix.assert_technician(uuid) to service_role;
grant execute on function montaigne_fix.lock_own_ticket(uuid, uuid) to service_role;
grant execute on function montaigne_fix.admin_assign(uuid, uuid, uuid) to service_role;
grant execute on function montaigne_fix.staff_assign(uuid, uuid, text, uuid) to service_role;
grant execute on function montaigne_fix.staff_ticket_detail(uuid, text) to service_role;
grant execute on function montaigne_fix.staff_list_tickets(uuid, text) to service_role;
