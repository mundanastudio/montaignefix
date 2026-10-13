-- Duplicado: original obligatorio y abierto, Equipo no los ve, quitar vuelve al estado anterior.
-- Códigos fijos (no gastan la secuencia). El RAISE final deshace todo.

do $$
declare
  v_fran uuid;
  v_agustin uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_d uuid;
  v_status montaigne_fix.ticket_status;
  v_dup uuid;
  v_priority montaigne_fix.ticket_priority;
  v_assigned uuid;
  v_list jsonb;
  v_choices jsonb;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';

  delete from montaigne_fix.tickets where code in ('MF-DUP-A', 'MF-DUP-B', 'MF-DUP-C', 'MF-DUP-D');

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-DUP-A', 'Ana', 'ana@ejemplo.com', 'Gotera en el techo', 'Aula 1')
  returning id into v_a;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-DUP-B', 'Luis', 'luis@ejemplo.com', 'Persiana que no sube', 'Aula 2')
  returning id into v_b;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-DUP-C', 'Eva', 'eva@ejemplo.com', 'Puerta que no cierra', 'Pasillo')
  returning id into v_c;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-DUP-D', 'Nuria', 'nuria@ejemplo.com', 'Grifo que gotea', 'Baños')
  returning id into v_d;

  perform montaigne_fix.admin_assign(v_fran, v_a, v_agustin);
  perform montaigne_fix.admin_assign(v_fran, v_b, v_agustin);
  perform montaigne_fix.admin_set_priority(v_fran, v_b, 'p2');
  perform montaigne_fix.admin_set_status(v_fran, v_b, 'en_curso', null);

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', '');
    raise exception 'FALLO: dejó marcar duplicado sin original';
  exception when others then
    if sqlerrm not like '%Elige el parte original%' then raise; end if;
  end;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-DUP-B');
    raise exception 'FALLO: dejó unir un parte a sí mismo';
  exception when others then
    if sqlerrm not like '%sí misma%' then raise; end if;
  end;

  perform montaigne_fix.admin_set_status(v_fran, v_c, 'cerrado', null);
  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-DUP-C');
    raise exception 'FALLO: dejó unir a un parte cerrado';
  exception when others then
    if sqlerrm not like '%tiene que estar abierto%' then raise; end if;
  end;

  perform montaigne_fix.admin_set_status(v_fran, v_c, 'reabrir', null);
  perform montaigne_fix.admin_set_status(
    v_fran, v_c, 'rechazado', null,
    'Lo hemos revisado y ya está solucionado o funciona correctamente.'
  );
  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-DUP-C');
    raise exception 'FALLO: dejó unir a un parte rechazado';
  exception when others then
    if sqlerrm not like '%tiene que estar abierto%' then raise; end if;
  end;
  perform montaigne_fix.admin_set_status(v_fran, v_c, 'reabrir', null);

  perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-DUP-A');

  select status, duplicate_of, priority, assigned_to
    into v_status, v_dup, v_priority, v_assigned
  from montaigne_fix.tickets
  where id = v_b;
  if v_status <> 'duplicado' or v_dup <> v_a or v_priority <> 'p2' or v_assigned <> v_agustin then
    raise exception 'FALLO: al unir no quedó duplicado del original con la misma prioridad y técnico';
  end if;

  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_b and event_type = 'duplicado' and new_value = 'MF-DUP-A'
  ) then
    raise exception 'FALLO: no quedó el evento de unir al parte original';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(montaigne_fix.linked_duplicates_json(v_a)) item
    where item->>'code' = 'MF-DUP-B'
  ) then
    raise exception 'FALLO: el original no lista el aviso unido';
  end if;

  v_choices := montaigne_fix.open_ticket_choices_json(v_b);
  if exists (
    select 1 from jsonb_array_elements(v_choices) item
    where item->>'code' = 'MF-DUP-B'
  ) then
    raise exception 'FALLO: el selector incluye el propio parte';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_choices) item
    where item->>'code' in ('MF-DUP-A', 'MF-DUP-C', 'MF-DUP-D')
  ) then
    raise exception 'FALLO: el selector no incluye un parte abierto';
  end if;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_d, 'duplicado', 'MF-DUP-B');
    raise exception 'FALLO: dejó unir a un parte ya duplicado';
  exception when others then
    if sqlerrm not like '%tiene que estar abierto%' then raise; end if;
  end;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'reabrir', null);
    raise exception 'FALLO: dejó reabrir un duplicado';
  exception when others then
    if sqlerrm not like '%Quita el duplicado%' then raise; end if;
  end;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'cerrado', null);
    raise exception 'FALLO: dejó cerrar un duplicado';
  exception when others then
    if sqlerrm not like '%Quita el duplicado%' then raise; end if;
  end;

  begin
    perform montaigne_fix.admin_set_status(
      v_fran, v_b, 'rechazado', null,
      'Lo hemos revisado y ya está solucionado o funciona correctamente.'
    );
    raise exception 'FALLO: dejó rechazar un duplicado';
  exception when others then
    if sqlerrm not like '%Quita el duplicado%' then raise; end if;
  end;

  v_list := montaigne_fix.staff_list_tickets(v_agustin, 'todas');
  if exists (
    select 1 from jsonb_array_elements(v_list->'tickets') item
    where item->>'code' = 'MF-DUP-B'
  ) then
    raise exception 'FALLO: Equipo seguía viendo el duplicado en Todas';
  end if;
  v_list := montaigne_fix.staff_list_tickets(v_agustin, 'mias');
  if exists (
    select 1 from jsonb_array_elements(v_list->'tickets') item
    where item->>'code' = 'MF-DUP-B'
  ) then
    raise exception 'FALLO: Equipo seguía viendo el duplicado en Mis tareas';
  end if;

  perform montaigne_fix.admin_set_status(v_fran, v_b, 'quitar_duplicado', null);
  select status, duplicate_of, priority, assigned_to
    into v_status, v_dup, v_priority, v_assigned
  from montaigne_fix.tickets
  where id = v_b;
  if v_status <> 'en_curso' or v_dup is not null or v_priority <> 'p2' or v_assigned <> v_agustin then
    raise exception 'FALLO: al quitar duplicado no volvió a como estaba (%)', v_status;
  end if;
  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_b and event_type = 'duplicado' and new_value = 'MF-DUP-A'
  ) then
    raise exception 'FALLO: al quitar duplicado se perdió el historial';
  end if;

  begin
    perform montaigne_fix.admin_set_status(v_fran, v_b, 'quitar_duplicado', null);
    raise exception 'FALLO: dejó quitar duplicado de un parte que ya no lo es';
  exception when others then
    if sqlerrm not like '%no está marcada como duplicado%' then raise; end if;
  end;

  perform montaigne_fix.admin_set_status(v_fran, v_b, 'duplicado', 'MF-DUP-A');
  perform montaigne_fix.admin_set_status(v_fran, v_a, 'cerrado', null);
  select status, duplicate_of into v_status, v_dup from montaigne_fix.tickets where id = v_b;
  if v_status <> 'cerrado' or v_dup is not null then
    raise exception 'FALLO: al cerrar el original el unido debía quedar cerrado y sin relación (%)', v_status;
  end if;
  select status into v_status from montaigne_fix.tickets where id = v_a;
  if v_status <> 'cerrado' then
    raise exception 'FALLO: el original no quedó cerrado (%)', v_status;
  end if;

  raise exception 'DUPLICADO_OK';
end $$;
