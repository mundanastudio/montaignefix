-- Pestañas de Gestión: abiertas / resueltas / cerradas, orden y duplicados ocultos.
-- Códigos fijos. El RAISE final deshace todo.

do $$
declare
  v_fran uuid;
  v_agustin uuid;
  v_json jsonb;
  v_codes text[];
  v_n int;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_agustin from montaigne_fix.staff where slug = 'agustin';

  delete from montaigne_fix.tickets where code like 'MF-GTB-%';

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values
    ('MF-GTB-1', 'Ana', 'ana@ejemplo.com', 'Sin prioridad vieja', 'Aula 1'),
    ('MF-GTB-2', 'Luis', 'luis@ejemplo.com', 'Sin prioridad nueva', 'Aula 2'),
    ('MF-GTB-3', 'Eva', 'eva@ejemplo.com', 'P2 asignada', 'Aula 3'),
    ('MF-GTB-4', 'Nuria', 'nuria@ejemplo.com', 'P2 nueva', 'Aula 4'),
    ('MF-GTB-5', 'Paco', 'paco@ejemplo.com', 'P1 nueva', 'Aula 5'),
    ('MF-GTB-6', 'Rita', 'rita@ejemplo.com', 'Duplicada', 'Aula 6'),
    ('MF-GTB-7', 'Sara', 'sara@ejemplo.com', 'Resuelta vieja', 'Aula 7'),
    ('MF-GTB-8', 'Toni', 'toni@ejemplo.com', 'Resuelta nueva', 'Aula 8'),
    ('MF-GTB-9', 'Uma', 'uma@ejemplo.com', 'Cerrada vieja', 'Aula 9'),
    ('MF-GTB-A', 'Vera', 'vera@ejemplo.com', 'Cerrada nueva', 'Aula 10');

  perform montaigne_fix.admin_set_priority(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-5'), 'p1');
  perform montaigne_fix.admin_set_priority(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-4'), 'p2');
  perform montaigne_fix.admin_set_priority(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-3'), 'p2');
  perform montaigne_fix.admin_assign(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-3'), v_agustin);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-7'), 'resuelto', null);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-8'), 'resuelto', null);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-9'), 'cerrado', null);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-A'), 'cerrado', null);
  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-6'), 'duplicado', 'MF-GTB-5');

  v_json := montaigne_fix.admin_list_tickets(v_fran, null, null, null, null, null, 'MF-GTB', 'abiertas');
  select coalesce(array_agg(x->>'code' order by ord), '{}')
    into v_codes
  from jsonb_array_elements(v_json->'tickets') with ordinality as t(x, ord);

  if v_codes <> array['MF-GTB-5', 'MF-GTB-4', 'MF-GTB-3', 'MF-GTB-1', 'MF-GTB-2']::text[] then
    raise exception 'FALLO: orden de abiertas %', v_codes;
  end if;
  if v_json->'tickets' @> '[{"code":"MF-GTB-6"}]' then
    raise exception 'FALLO: el duplicado no debía salir en abiertas';
  end if;
  if (v_json->'counts'->>'abiertas') is null or (v_json->'counts'->>'cerradas') is null then
    raise exception 'FALLO: faltan contadores de pestaña %', v_json->'counts';
  end if;

  v_json := montaigne_fix.admin_list_tickets(v_fran, null, null, null, null, null, 'MF-GTB', 'resueltas');
  select coalesce(array_agg(x->>'code' order by ord), '{}')
    into v_codes
  from jsonb_array_elements(v_json->'tickets') with ordinality as t(x, ord);
  if v_codes <> array['MF-GTB-8', 'MF-GTB-7']::text[] then
    raise exception 'FALLO: resueltas debían ir de más reciente a más antigua, %', v_codes;
  end if;

  v_json := montaigne_fix.admin_list_tickets(v_fran, null, null, null, null, null, 'MF-GTB', 'cerradas');
  select coalesce(array_agg(x->>'code' order by ord), '{}')
    into v_codes
  from jsonb_array_elements(v_json->'tickets') with ordinality as t(x, ord);
  if v_codes <> array['MF-GTB-A', 'MF-GTB-9']::text[] then
    raise exception 'FALLO: cerradas debían ir de más reciente a más antigua, %', v_codes;
  end if;
  if v_json->'tickets' @> '[{"code":"MF-GTB-6"}]' then
    raise exception 'FALLO: el duplicado no debía salir en cerradas todavía';
  end if;

  perform montaigne_fix.admin_set_status(v_fran, (select id from montaigne_fix.tickets where code = 'MF-GTB-5'), 'cerrado', null);
  v_json := montaigne_fix.admin_list_tickets(v_fran, null, null, null, null, null, 'MF-GTB', 'cerradas');
  if not (v_json->'tickets' @> '[{"code":"MF-GTB-6"}]') then
    raise exception 'FALLO: al cerrar el original el duplicado debía salir en cerradas';
  end if;
  v_json := montaigne_fix.admin_list_tickets(v_fran, null, null, null, null, null, 'MF-GTB', 'abiertas');
  if v_json->'tickets' @> '[{"code":"MF-GTB-5"}]' or v_json->'tickets' @> '[{"code":"MF-GTB-6"}]' then
    raise exception 'FALLO: el original cerrado o el duplicado no deben salir en abiertas';
  end if;

  select count(*) into v_n from montaigne_fix.tickets where code like 'MF-GTB-%' and status = 'duplicado';
  if v_n <> 0 then
    raise exception 'FALLO: el duplicado debía haber pasado a cerrado';
  end if;

  raise exception 'GESTION_TABS_OK';
end $$;
