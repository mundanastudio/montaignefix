-- Combos de asignación: Gestión los elige, Equipo los trabaja si sale en el grupo.

do $$
declare
  v_fran uuid;
  v_agustin uuid;
  v_andres uuid;
  v_combo uuid;
  v_ticket uuid;
  v_json jsonb;
  v_item jsonb;
  v_seen_closed boolean;
  v_n int;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';
  select id into v_andres from montaigne_fix.staff where slug = 'andres';
  select id into v_combo from montaigne_fix.staff where slug = 'agustin-andres';

  if v_combo is null then
    raise exception 'FALLO: faltaba el combo Agustín+Andrés';
  end if;

  select count(*) into v_n from montaigne_fix.staff where is_combo;
  if v_n <> 4 then
    raise exception 'FALLO: debían existir 4 combos, hay %', v_n;
  end if;

  if jsonb_array_length(montaigne_fix.technician_options()) <> 7 then
    raise exception 'FALLO: Gestión debía ver 3 personas y 4 equipos';
  end if;
  if jsonb_array_length(montaigne_fix.team_technician_options()) <> 3 then
    raise exception 'FALLO: el PIN no debe listar los combos';
  end if;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-CMB-1', 'Ana', 'ana@ejemplo.com', 'Combo de prueba', 'Aula 1')
  returning id into v_ticket;

  perform montaigne_fix.admin_assign(v_fran, v_ticket, v_combo);

  v_json := montaigne_fix.staff_list_tickets(v_andres, 'mias');
  if not (v_json->'tickets' @> '[{"code":"MF-CMB-1"}]') then
    raise exception 'FALLO: Andrés debía ver el combo en Mis tareas';
  end if;
  v_json := montaigne_fix.staff_list_tickets(v_agustin, 'mias');
  if not (v_json->'tickets' @> '[{"code":"MF-CMB-1"}]') then
    raise exception 'FALLO: Agustín debía ver el combo en Mis tareas';
  end if;
  v_json := montaigne_fix.staff_list_tickets(v_fran, 'mias');
  if v_json->'tickets' @> '[{"code":"MF-CMB-1"}]' then
    raise exception 'FALLO: Fran no está en Agustín+Andrés';
  end if;

  perform montaigne_fix.staff_set_status(v_andres, v_ticket, 'en_curso');

  begin
    perform montaigne_fix.staff_set_status(v_fran, v_ticket, 'en_espera');
    raise exception 'FALLO: Fran cambió un combo del que no forma parte';
  exception when others then
    if sqlerrm not like '%Solo puedes modificar%' then raise; end if;
  end;

  perform montaigne_fix.staff_assign(v_andres, v_ticket, 'reasignar', v_combo);

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-CMB-2', 'Luis', 'luis@ejemplo.com', 'Cerrada de prueba', 'Aula 2');
  perform montaigne_fix.admin_assign(v_fran, (select id from montaigne_fix.tickets where code = 'MF-CMB-2'), v_andres);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-CMB-2'), 'cerrado', null);
  perform montaigne_fix.admin_set_status(v_fran, v_ticket, 'resuelto', null);

  v_json := montaigne_fix.staff_list_tickets(v_andres, 'todas');
  if v_json->'tickets' @> '[{"code":"MF-CMB-1"}]' then
    raise exception 'FALLO: Todas no debía mostrar resueltas';
  end if;
  if not (v_json->'tickets' @> '[{"code":"MF-CMB-2"}]') then
    raise exception 'FALLO: Todas debía mostrar las cerradas';
  end if;
  v_json := montaigne_fix.staff_list_tickets(v_andres, 'mias');
  if v_json->'tickets' @> '[{"code":"MF-CMB-2"}]' then
    raise exception 'FALLO: Mis tareas no debía mostrar cerradas';
  end if;
  if not (v_json->'tickets' @> '[{"code":"MF-CMB-1"}]') then
    raise exception 'FALLO: Mis tareas debía seguir mostrando la resuelta';
  end if;

  v_json := montaigne_fix.staff_list_tickets(v_andres, 'todas');
  v_seen_closed := false;
  for v_item in select jsonb_array_elements(v_json->'tickets')
  loop
    if v_item->>'status' = 'cerrado' then
      v_seen_closed := true;
    elsif v_seen_closed then
      raise exception 'FALLO: una abierta iba detrás de una cerrada en Todas';
    end if;
  end loop;

  raise exception 'COMBOS_OK';
end $$;
