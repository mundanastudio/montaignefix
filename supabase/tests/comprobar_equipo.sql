-- Prueba las acciones del equipo y deshace todo al terminar.

do $$
declare
  v_fran uuid;
  v_agustin uuid;
  v_ticket uuid;
  v_item uuid;
  v_status montaigne_fix.ticket_status;
  v_resolved timestamptz;
  v_events int;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-EQ', 'Ana', 'ana@ejemplo.com', 'Persiana atascada', 'Aula 2')
  returning id into v_ticket;

  begin
    perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'en_curso');
    raise exception 'FALLO: Agustín cambió una incidencia que no es suya';
  exception when others then
    if sqlerrm not like '%MF: Solo puedes modificar%' then
      raise;
    end if;
  end;

  perform montaigne_fix.staff_assign(v_agustin, v_ticket, 'tomar', null);
  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'asignado' then
    raise exception 'FALLO: al asignársela debía quedar asignado, está %', v_status;
  end if;

  perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'en_curso');
  perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'en_curso');
  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'asignado' then
    raise exception 'FALLO: repetir En curso debía volver a asignado, está %', v_status;
  end if;
  perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'en_curso');
  perform montaigne_fix.staff_add_note(v_agustin, v_ticket, 'Falta la manivela');
  perform montaigne_fix.staff_add_materials(v_agustin, v_ticket, array['', '  ', 'cinta de persiana']);

  select id into v_item
  from montaigne_fix.shopping_items
  where ticket_id = v_ticket and description = 'cinta de persiana';

  if (select count(*) from montaigne_fix.shopping_items where ticket_id = v_ticket) <> 1 then
    raise exception 'FALLO: las líneas vacías no se ignoraron';
  end if;

  begin
    perform montaigne_fix.staff_delete_material(v_fran, v_item);
    raise exception 'FALLO: Fran borró un material que no pidió él';
  exception when others then
    if sqlerrm not like '%MF: Solo puedes borrar%' and sqlerrm not like '%MF: Solo puedes modificar%' then
      raise;
    end if;
  end;

  perform montaigne_fix.staff_assign(v_agustin, v_ticket, 'reasignar', v_fran);
  perform montaigne_fix.staff_set_status(v_fran, v_ticket, 'resuelto');

  select status, resolved_at into v_status, v_resolved from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'resuelto' or v_resolved is null then
    raise exception 'FALLO: resuelto no guardó la fecha';
  end if;

  select count(*) into v_events
  from montaigne_fix.ticket_events
  where ticket_id = v_ticket and event_type = 'material_solicitado' and actor_id = v_agustin;

  if v_events <> 1 then
    raise exception 'FALLO: el material no quedó en el historial a nombre de Agustín';
  end if;

  raise exception 'PRUEBAS_OK';
end $$;
