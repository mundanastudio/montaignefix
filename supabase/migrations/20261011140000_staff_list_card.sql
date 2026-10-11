-- La lista del equipo incluye observaciones del solicitante y materiales,
-- para mostrarlos en cada tarea sin abrir la incidencia.

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
