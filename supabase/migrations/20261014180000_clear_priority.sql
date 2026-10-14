-- Gestión puede quitar la prioridad volviendo a elegir la P activa.

create or replace function montaigne_fix.admin_set_priority(p_actor uuid, p_ticket uuid, p_priority text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_priority text := nullif(btrim(coalesce(p_priority, '')), '');
begin
  perform montaigne_fix.assert_manager(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

  if v_priority is not null and v_priority not in ('p1', 'p2', 'p3') then
    raise exception 'MF: Elige P1, P2 o P3.';
  end if;

  update montaigne_fix.tickets
  set priority = case
    when v_priority is null then null
    else v_priority::montaigne_fix.ticket_priority
  end
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

revoke all on function montaigne_fix.admin_set_priority(uuid, uuid, text) from public, anon, authenticated;
grant execute on function montaigne_fix.admin_set_priority(uuid, uuid, text) to service_role;
