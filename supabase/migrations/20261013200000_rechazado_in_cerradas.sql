-- Rechazado sale en la pestaña Cerradas, no en Abiertas.

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
      where status not in ('resuelto', 'duplicado', 'cerrado', 'rechazado')
    ),
    'resueltas', (select count(*) from montaigne_fix.tickets where status = 'resuelto'),
    'cerradas', (
      select count(*) from montaigne_fix.tickets
      where status in ('cerrado', 'rechazado')
    ),
    'pendientesCompra', (select count(*) from montaigne_fix.shopping_items where status = 'pendiente')
  );
$$;

create or replace function montaigne_fix.admin_list_ticket_rows(
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
      else 5
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
      (p_tab = 'abiertas' and t.status not in ('resuelto', 'duplicado', 'cerrado', 'rechazado'))
      or (p_tab = 'resueltas' and t.status = 'resuelto')
      or (p_tab = 'cerradas' and t.status in ('cerrado', 'rechazado'))
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

revoke all on function montaigne_fix.ticket_counts() from public, anon, authenticated;
revoke all on function montaigne_fix.admin_list_ticket_rows(text, text, text, text, uuid, date, date, text) from public, anon, authenticated;
grant execute on function montaigne_fix.ticket_counts() to service_role;
grant execute on function montaigne_fix.admin_list_ticket_rows(text, text, text, text, uuid, date, date, text) to service_role;
