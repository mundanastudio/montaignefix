-- Borrado total de una incidencia desde gestión. El código MF- no se reutiliza.

create function montaigne_fix.admin_delete_ticket(p_actor uuid, p_ticket uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_photo text;
begin
  perform montaigne_fix.assert_manager(p_actor);

  select photo_path into v_photo
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  delete from montaigne_fix.email_log where ticket_id = p_ticket;
  delete from montaigne_fix.tickets where id = p_ticket;

  return montaigne_fix.ticket_counts() || jsonb_build_object('photoPath', v_photo);
end;
$$;

revoke all on function montaigne_fix.admin_delete_ticket(uuid, uuid) from public, anon, authenticated;
grant execute on function montaigne_fix.admin_delete_ticket(uuid, uuid) to service_role;
