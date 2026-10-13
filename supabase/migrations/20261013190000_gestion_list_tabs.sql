-- Gestión: pestañas Abiertas / Resueltas / Cerradas, orden distinto y contadores.

create or replace function montaigne_fix.ticket_counts()
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
    'abiertas', (
      select count(*) from montaigne_fix.tickets
      where status not in ('resuelto', 'duplicado', 'cerrado')
    ),
    'resueltas', (select count(*) from montaigne_fix.tickets where status = 'resuelto'),
    'cerradas', (select count(*) from montaigne_fix.tickets where status = 'cerrado'),
    'pendientesCompra', (select count(*) from montaigne_fix.shopping_items where status = 'pendiente')
  );
$$;

create function montaigne_fix.admin_list_ticket_rows(
  p_tab text,
  p_status text,
  p_priority text,
  p_assigned text,
  p_assignee uuid,
  p_from date,
  p_to date,
  p_query text
)
returns table (
  sort_priority integer,
  sort_status integer,
  code text,
  item jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    case t.priority when 'p1' then 1 when 'p2' then 2 when 'p3' then 3 else 4 end,
    case
      when t.priority is null then 0
      when t.status = 'nuevo' then 1
      when t.status = 'asignado' then 2
      when t.status = 'en_curso' then 3
      when t.status = 'en_espera' then 4
      when t.status = 'rechazado' then 5
      else 6
    end,
    t.code,
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
    )
  from montaigne_fix.tickets t
  left join montaigne_fix.staff s on s.id = t.assigned_to
  where (
      (p_tab = 'abiertas' and t.status not in ('resuelto', 'duplicado', 'cerrado'))
      or (p_tab = 'resueltas' and t.status = 'resuelto')
      or (p_tab = 'cerradas' and t.status = 'cerrado')
    )
    and (p_status is null or t.status::text = p_status)
    and (
      p_priority is null
      or (p_priority = 'ninguna' and t.priority is null)
      or t.priority::text = p_priority
    )
    and (
      p_assigned is null
      or (p_assigned = 'ninguno' and t.assigned_to is null)
      or t.assigned_to = p_assignee
    )
    and (p_from is null or (t.created_at at time zone 'Europe/Madrid')::date >= p_from)
    and (p_to is null or (t.created_at at time zone 'Europe/Madrid')::date <= p_to)
    and (
      p_query is null
      or t.code ilike '%' || p_query || '%' escape '\'
      or t.requester_name ilike '%' || p_query || '%' escape '\'
      or t.description ilike '%' || p_query || '%' escape '\'
      or t.location ilike '%' || p_query || '%' escape '\'
    )
$$;

drop function if exists montaigne_fix.admin_list_tickets(uuid, text, text, text, date, date, text);

create function montaigne_fix.admin_list_tickets(
  p_actor uuid,
  p_status text,
  p_priority text,
  p_assigned text,
  p_from date,
  p_to date,
  p_query text,
  p_tab text
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
  v_tab text := nullif(btrim(coalesce(p_tab, '')), '');
  v_assignee uuid;
  v_tickets jsonb;
begin
  perform montaigne_fix.assert_manager(p_actor);

  if v_tab is null then
    v_tab := 'abiertas';
  end if;
  if v_tab not in ('abiertas', 'resueltas', 'cerradas') then
    raise exception 'MF: Esa vista no es válida.';
  end if;

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

  if v_tab in ('resueltas', 'cerradas') then
    select coalesce(jsonb_agg(item order by code desc), '[]'::jsonb)
    into v_tickets
    from montaigne_fix.admin_list_ticket_rows(
      v_tab, v_status, v_priority, v_assigned, v_assignee, p_from, p_to, v_query
    );
  else
    select coalesce(jsonb_agg(item order by sort_priority, sort_status, code), '[]'::jsonb)
    into v_tickets
    from montaigne_fix.admin_list_ticket_rows(
      v_tab, v_status, v_priority, v_assigned, v_assignee, p_from, p_to, v_query
    );
  end if;

  return jsonb_build_object(
    'counts', montaigne_fix.ticket_counts(),
    'technicians', montaigne_fix.technician_options(),
    'tickets', v_tickets
  );
end;
$$;

revoke all on function montaigne_fix.ticket_counts() from public, anon, authenticated;
revoke all on function montaigne_fix.admin_list_ticket_rows(text, text, text, text, uuid, date, date, text) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_list_tickets(uuid, text, text, text, date, date, text, text) from public, anon, authenticated;
grant execute on function montaigne_fix.ticket_counts() to service_role;
grant execute on function montaigne_fix.admin_list_ticket_rows(text, text, text, text, uuid, date, date, text) to service_role;
grant execute on function montaigne_fix.admin_list_tickets(uuid, text, text, text, date, date, text, text) to service_role;
