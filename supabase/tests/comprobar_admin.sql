-- Prueba las acciones de gerencia y deshace todo al terminar.
-- No consume códigos MF reales: usa códigos de prueba que desaparecen con el rollback.

do $$
declare
  v_fran uuid;
  v_agustin uuid;
  v_a uuid;
  v_b uuid;
  v_item uuid;
  v_other uuid;
  v_changed int;
  v_status montaigne_fix.ticket_status;
  v_events int;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-A', 'Ana', 'ana@ejemplo.com', 'Gotera en el techo', 'Aula 1')
  returning id into v_a;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-B', 'Luis', 'luis@ejemplo.com', 'Puerta que no cierra', 'Pasillo')
  returning id into v_b;

  perform montaigne_fix.admin_set_priority(v_fran, v_a, 'p1');
  perform montaigne_fix.admin_assign(v_fran, v_a, v_agustin);

  select status into v_status from montaigne_fix.tickets where id = v_a;
  if v_status <> 'asignado' then
    raise exception 'FALLO: al asignar debía quedar asignado, está %', v_status;
  end if;

  perform montaigne_fix.admin_set_status(v_fran, v_a, 'en_curso', null);
  perform montaigne_fix.admin_add_note(v_fran, v_a, 'Llamar al proveedor');
  perform montaigne_fix.admin_add_materials(v_fran, v_a, array['silicona blanca', '2 bisagras 35 mm']);

  select id into v_item from montaigne_fix.shopping_items where ticket_id = v_a and description = 'silicona blanca';
  select id into v_other from montaigne_fix.shopping_items where ticket_id = v_a and description = '2 bisagras 35 mm';

  select (montaigne_fix.admin_mark_purchased(v_fran, array[v_item, v_other]) ->> 'changed')::int into v_changed;
  if v_changed <> 2 then
    raise exception 'FALLO: debían comprarse 2 y se compraron %', v_changed;
  end if;

  select (montaigne_fix.admin_mark_purchased(v_fran, array[v_item]) ->> 'changed')::int into v_changed;
  if v_changed <> 0 then
    raise exception 'FALLO: repetir la compra debía cambiar 0 y cambió %', v_changed;
  end if;

  perform montaigne_fix.admin_unmark_purchased(v_fran, v_item);
  perform montaigne_fix.admin_delete_material(v_fran, v_item);

  if exists (select 1 from montaigne_fix.shopping_items where id = v_item) then
    raise exception 'FALLO: el pendiente borrado sigue en la tabla';
  end if;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_a, 'cerrado', null);
    raise exception 'FALLO: dejó cerrar una incidencia que no está resuelta';
  exception when others then
    if sqlerrm not like '%MF: Solo se cierra%' then
      raise;
    end if;
  end;

  perform montaigne_fix.admin_set_status(v_fran, v_a, 'resuelto', null);
  perform montaigne_fix.admin_set_status(v_fran, v_a, 'cerrado', null);
  perform montaigne_fix.admin_set_status(v_fran, v_a, 'reabrir', null);

  select status into v_status from montaigne_fix.tickets where id = v_a;
  if v_status <> 'asignado' then
    raise exception 'FALLO: al reabrir con técnico debía quedar asignado, está %', v_status;
  end if;

  perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-TEST-A');

  select count(*) into v_events
  from montaigne_fix.ticket_events
  where ticket_id = v_a
    and event_type in ('material_solicitado', 'material_comprado', 'material_repuesto', 'material_borrado')
    and actor_id = v_fran;

  if v_events <> 6 then
    raise exception 'FALLO: el historial de materiales debía tener 6 eventos y tiene %', v_events;
  end if;

  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_a and event_type = 'prioridad' and actor_label = 'Fran' and new_value = 'p1'
  ) then
    raise exception 'FALLO: la prioridad no quedó a nombre de Fran';
  end if;

  delete from montaigne_fix.tickets where id = v_a;
  if exists (select 1 from montaigne_fix.shopping_items where ticket_id = v_a) then
    raise exception 'FALLO: al borrar el parte no se fueron sus materiales';
  end if;

  raise exception 'PRUEBAS_OK';
end $$;
