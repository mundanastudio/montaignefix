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

  begin
    perform montaigne_fix.staff_add_materials(v_agustin, v_ticket, array['no debe poder']);
    raise exception 'FALLO: Agustín pidió material en una tarea de Andrés';
  exception when others then
    if sqlerrm not like '%asignadas%' then raise; end if;
  end;

  begin
    perform montaigne_fix.staff_set_status(v_agustin, v_ticket, 'resuelto');
    raise exception 'FALLO: Agustín cambió una tarea de Andrés';
  exception when others then
    if sqlerrm not like '%asignadas%' then raise; end if;
  end;

  select id into v_item from montaigne_fix.shopping_items where ticket_id = v_ticket and status = 'pendiente' limit 1;

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
  perform montaigne_fix.staff_set_status(v_andres, v_ticket, 'resuelto');
  perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'cerrado', null);

  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'cerrado' then
    raise exception 'FALLO: no quedó cerrada (%).', v_status;
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

  perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'rechazado', null);
  select status into v_status from montaigne_fix.tickets where id = v_ticket;
  if v_status <> 'rechazado' then
    raise exception 'FALLO: no quedó rechazada';
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
