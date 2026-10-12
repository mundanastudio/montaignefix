-- Recorrido de la Fase 8. Usa el código fijo MF-FASE8 (no gasta la secuencia) y lo borra al final.
-- Si todo cuadra, termina con FASE8 OK.

do $$
declare
  v_fran uuid;
  v_andres uuid;
  v_agustin uuid;
  v_curro uuid;
  v_ticket uuid;
  v_item uuid;
  v_status montaigne_fix.ticket_status;
  v_assigned uuid;
  v_n int;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_andres from montaigne_fix.staff where slug = 'andres';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';
  select id into v_curro from montaigne_fix.staff where slug = 'curro';

  delete from montaigne_fix.tickets where code = 'MF-FASE8';

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-FASE8', 'Profesor de prueba', 'fase8@example.com', 'Persiana de prueba', 'Aula 0')
  returning id into v_ticket;

  perform montaigne_fix.admin_assign(v_fran, v_ticket, v_andres);
  perform montaigne_fix.admin_set_priority(v_fran, v_ticket, 'p1');

  select status, assigned_to into v_status, v_assigned from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'asignado' or v_assigned <> v_andres then
    raise exception 'FALLO: tras asignar quedó % / %', v_status, v_assigned;
  end if;

  perform montaigne_fix.staff_set_status(v_andres, v_ticket, 'en_curso');
  perform montaigne_fix.staff_add_materials(v_andres, v_ticket, array['silicona de prueba']);
  perform montaigne_fix.staff_add_materials(v_agustin, v_ticket, array['tornillo', 'arandela', 'tuerca']);

  select count(*) into v_n from montaigne_fix.shopping_items where ticket_id = v_ticket and requested_by = v_agustin;
  if v_n <> 3 then
    raise exception 'FALLO: pegar 3 líneas no creó 3 artículos (%)', v_n;
  end if;

  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_ticket and event_type = 'material_solicitado' and actor_id = v_agustin
  ) then
    raise exception 'FALLO: no quedó el historial de material pedido por Agustín';
  end if;

  select id into v_item from montaigne_fix.shopping_items where ticket_id = v_ticket and description = 'tornillo';
  perform montaigne_fix.staff_edit_material(v_andres, v_item, 'tornillo M6');
  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_ticket and event_type = 'material_editado' and actor_id = v_andres
  ) then
    raise exception 'FALLO: no quedó el historial de edición';
  end if;

  perform montaigne_fix.staff_delete_material(v_andres, v_item);
  if exists (select 1 from montaigne_fix.shopping_items where id = v_item) then
    raise exception 'FALLO: Andrés no pudo borrar el material de Agustín';
  end if;
  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_ticket and event_type = 'material_borrado' and actor_id = v_andres
  ) then
    raise exception 'FALLO: no quedó el historial de borrado';
  end if;

  begin
    perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'resuelto');
    raise exception 'FALLO: Agustín cambió una tarea de Andrés';
  exception when others then
    if sqlerrm not like '%asignadas%' then raise; end if;
  end;

  select id into v_item from montaigne_fix.shopping_items
  where ticket_id = v_ticket and description = 'silicona de prueba';

  begin
    perform montaigne_fix.admin_mark_purchased(v_andres, array[v_item]);
    raise exception 'FALLO: Andrés marcó un material como comprado';
  exception when others then
    if sqlerrm not like '%caducado%' then raise; end if;
  end;

  begin
    perform montaigne_fix.staff_set_status(v_curro, v_ticket, 'en_curso');
    raise exception 'FALLO: Curro actuó como técnico';
  exception when others then
    if sqlerrm not like '%caducado%' then raise; end if;
  end;

  perform montaigne_fix.admin_mark_purchased(v_fran, array[v_item]);
  if exists (select 1 from montaigne_fix.shopping_items where id = v_item and status = 'pendiente') then
    raise exception 'FALLO: el material comprado sigue en la lista de pendientes';
  end if;

  begin
    perform montaigne_fix.staff_edit_material(v_andres, v_item, 'ya comprado');
    raise exception 'FALLO: se editó un material que Fran acababa de marcar como comprado';
  exception when others then
    if sqlerrm not like '%Recarga la ficha%' then raise; end if;
  end;

  perform montaigne_fix.staff_set_status(v_andres, v_ticket, 'resuelto');
  perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'cerrado', null);

  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'cerrado' then
    raise exception 'FALLO: no quedó cerrada (%).', v_status;
  end if;

  begin
    perform montaigne_fix.staff_add_materials(v_andres, v_ticket, array['no en cerrado']);
    raise exception 'FALLO: Andrés añadió material en un parte cerrado';
  exception when others then
    if sqlerrm not like '%cerrado, rechazado o duplicado%' then raise; end if;
  end;

  select id into v_item from montaigne_fix.shopping_items
  where ticket_id = v_ticket and status = 'pendiente' limit 1;
  if v_item is null then
    raise exception 'FALLO: no quedó material pendiente para probar el parte cerrado';
  end if;

  begin
    perform montaigne_fix.staff_edit_material(v_andres, v_item, 'no en cerrado');
    raise exception 'FALLO: Andrés editó material en un parte cerrado';
  exception when others then
    if sqlerrm not like '%cerrado, rechazado o duplicado%' then raise; end if;
  end;

  begin
    perform montaigne_fix.staff_delete_material(v_andres, v_item);
    raise exception 'FALLO: Andrés borró material en un parte cerrado';
  exception when others then
    if sqlerrm not like '%cerrado, rechazado o duplicado%' then raise; end if;
  end;

  perform montaigne_fix.admin_add_materials(v_fran, v_ticket, array['cinta de testers']);
  select id into v_item from montaigne_fix.shopping_items
  where ticket_id = v_ticket and description = 'cinta de testers';
  perform montaigne_fix.admin_edit_material(v_fran, v_item, 'cinta americana');
  perform montaigne_fix.admin_delete_material(v_fran, v_item);
  if exists (select 1 from montaigne_fix.shopping_items where description = 'cinta americana' and ticket_id = v_ticket) then
    raise exception 'FALLO: Gestión no pudo borrar material en un parte cerrado';
  end if;

  perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'reabrir', null);
  select status, assigned_to into v_status, v_assigned from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'asignado' or v_assigned <> v_andres then
    raise exception 'FALLO: al reabrir quedó % asignada a %', v_status, v_assigned;
  end if;

  perform montaigne_fix.admin_assign(v_fran, v_ticket, v_agustin);
  begin
    perform montaigne_fix.staff_set_status(v_andres, v_ticket, 'en_curso');
    raise exception 'FALLO: Andrés siguió pudiendo tocar la tarea reasignada';
  exception when others then
    if sqlerrm not like '%asignadas%' then raise; end if;
  end;

  perform montaigne_fix.staff_assign(v_agustin, v_ticket, 'reasignar', v_andres);
  select assigned_to into v_assigned from montaigne_fix.tickets where id = v_ticket;
  if v_assigned <> v_andres then
    raise exception 'FALLO: la reasignación del técnico no llegó a Andrés';
  end if;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'rechazado', null, 'corto');
    raise exception 'FALLO: rechazó con un motivo demasiado corto';
  exception when others then
    if sqlerrm not like '%motivo del rechazo%' then raise; end if;
  end;

  perform montaigne_fix.admin_set_status(
    v_fran, v_ticket, 'rechazado', null,
    'No es una reparación: es una compra de material o equipamiento nuevo.'
  );
  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'rechazado' then
    raise exception 'FALLO: no quedó rechazada';
  end if;
  if not exists (
    select 1 from montaigne_fix.tickets
    where id = v_ticket and rejection_reason like 'No es una reparación%'
  ) then
    raise exception 'FALLO: no quedó el motivo del rechazo';
  end if;

  select count(*) into v_n from montaigne_fix.ticket_events where ticket_id = v_ticket;
  if v_n < 5 then
    raise exception 'FALLO: el historial tiene solo % eventos', v_n;
  end if;

  perform montaigne_fix.admin_delete_ticket(v_fran, v_ticket);

  if exists (select 1 from montaigne_fix.tickets where id = v_ticket)
     or exists (select 1 from montaigne_fix.ticket_notes where ticket_id = v_ticket)
     or exists (select 1 from montaigne_fix.ticket_events where ticket_id = v_ticket)
     or exists (select 1 from montaigne_fix.shopping_items where ticket_id = v_ticket)
     or exists (select 1 from montaigne_fix.email_log where ticket_id = v_ticket) then
    raise exception 'FALLO: quedó rastro de MF-FASE8';
  end if;

  raise exception 'FASE8 OK';
end $$;
