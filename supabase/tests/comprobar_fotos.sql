-- Varias fotos por parte. Deshace todo al terminar (excepción FOTOS_OK).
-- No gasta la secuencia MF ni toca MF-0001.

do $$
declare
  v_fran uuid;
  v_andres uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_requester uuid;
  v_andres_photo uuid;
  v_paths text[];
  v_i int;
  v_n int;
  v_who uuid;
  v_json jsonb;
begin
  select id into v_fran from montaigne_fix.staff where slug = 'fran';
  select id into v_andres from montaigne_fix.staff where slug = 'andres';

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-F1', 'Ana', 'ana@ejemplo.com', 'Gotera', 'Aula 1')
  returning id into v_a;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-F2', 'Luis', 'luis@ejemplo.com', 'Puerta', 'Pasillo')
  returning id into v_b;

  insert into montaigne_fix.tickets (code, requester_name, requester_email, description, location)
  values ('MF-TEST-F3', 'Eva', 'eva@ejemplo.com', 'Persiana', 'Aula 2')
  returning id into v_c;

  update montaigne_fix.tickets
  set photo_path = v_a::text || '.jpg'
  where id = v_a;

  insert into montaigne_fix.ticket_photos (ticket_id, path, sort_order, uploaded_by)
  values (v_a, v_a::text || '.jpg', 1, null);

  select cardinality(montaigne_fix.ticket_photo_paths(v_a)) into v_n;
  if v_n <> 1 then
    raise exception 'FALLO: la ruta antigua debía aparecer una sola vez y hay %', v_n;
  end if;

  begin
    perform montaigne_fix.add_ticket_photos(
      v_andres, v_a, array[v_b::text || '/' || gen_random_uuid()::text || '.jpg'], false
    );
    raise exception 'FALLO: aceptó una ruta de otro parte';
  exception when others then
    if sqlerrm not like '%no pertenece a este parte%' then raise; end if;
  end;

  begin
    perform montaigne_fix.add_ticket_photos(
      v_andres, v_a, array[v_a::text || '.jpg'], false
    );
    raise exception 'FALLO: aceptó la ruta antigua {id}.jpg';
  exception when others then
    if sqlerrm not like '%no pertenece a este parte%' then raise; end if;
  end;

  v_json := montaigne_fix.insert_requester_photos(
    v_a, array[v_a::text || '/' || gen_random_uuid()::text || '.jpg']
  );
  if (v_json ->> 'added')::int <> 1 then
    raise exception 'FALLO: el solicitante debía añadir 1 foto y añadió %', v_json ->> 'added';
  end if;

  select id into v_requester
  from montaigne_fix.ticket_photos
  where ticket_id = v_a and uploaded_by is null and path like v_a::text || '/%';

  begin
    perform montaigne_fix.insert_requester_photos(
      v_a,
      array[
        v_a::text || '/' || gen_random_uuid()::text || '.jpg',
        v_a::text || '/' || gen_random_uuid()::text || '.jpg',
        v_a::text || '/' || gen_random_uuid()::text || '.jpg',
        v_a::text || '/' || gen_random_uuid()::text || '.jpg'
      ]
    );
    raise exception 'FALLO: el solicitante envió 4 fotos';
  exception when others then
    if sqlerrm not like '%máximo 3 fotos%' then raise; end if;
  end;

  v_json := montaigne_fix.add_ticket_photos(
    v_andres, v_a, array[v_a::text || '/' || gen_random_uuid()::text || '.jpg'], false
  );
  if (v_json ->> 'added')::int <> 1 then
    raise exception 'FALLO: Andrés debía añadir 1 foto';
  end if;

  select id, uploaded_by into v_andres_photo, v_who
  from montaigne_fix.ticket_photos
  where ticket_id = v_a and uploaded_by = v_andres;
  if v_who is distinct from v_andres then
    raise exception 'FALLO: uploaded_by no es el técnico que subió la foto';
  end if;
  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_a and event_type = 'foto_anadida' and actor_id = v_andres
  ) then
    raise exception 'FALLO: no quedó foto_anadida en el historial';
  end if;

  begin
    perform montaigne_fix.delete_ticket_photo(v_fran, v_andres_photo, false);
    raise exception 'FALLO: Fran desde el equipo borró una foto de Andrés';
  exception when others then
    if sqlerrm not like '%Solo puedes borrar las fotos que has subido tú%' then raise; end if;
  end;

  begin
    perform montaigne_fix.delete_ticket_photo(v_fran, v_requester, false);
    raise exception 'FALLO: Fran desde el equipo borró una foto del solicitante';
  exception when others then
    if sqlerrm not like '%Solo puedes borrar las fotos que has subido tú%' then raise; end if;
  end;

  perform montaigne_fix.delete_ticket_photo(v_fran, v_andres_photo, true);
  perform montaigne_fix.delete_ticket_photo(v_fran, v_requester, true);
  if exists (
    select 1 from montaigne_fix.ticket_photos where id in (v_andres_photo, v_requester)
  ) then
    raise exception 'FALLO: Gestión no pudo borrar las fotos';
  end if;
  if not exists (
    select 1 from montaigne_fix.ticket_events
    where ticket_id = v_a and event_type = 'foto_borrada' and actor_id = v_fran
  ) then
    raise exception 'FALLO: no quedó foto_borrada en el historial';
  end if;

  update montaigne_fix.tickets
  set status = 'cerrado', resolved_at = now(), closed_at = now()
  where id = v_a;
  perform montaigne_fix.add_ticket_photos(
    v_andres, v_a, array[v_a::text || '/' || gen_random_uuid()::text || '.jpg'], false
  );
  if not exists (
    select 1 from montaigne_fix.ticket_photos where ticket_id = v_a and uploaded_by = v_andres
  ) then
    raise exception 'FALLO: no se pudo añadir una foto a un parte cerrado';
  end if;

  v_paths := '{}';
  for v_i in 1..10 loop
    v_paths := array_append(v_paths, v_c::text || '/' || v_i::text || '.jpg');
  end loop;
  perform montaigne_fix.add_ticket_photos(v_andres, v_c, v_paths, false);
  begin
    perform montaigne_fix.add_ticket_photos(
      v_andres, v_c, array[v_c::text || '/11.jpg'], false
    );
    raise exception 'FALLO: dejó pasar la foto 11';
  exception when others then
    if sqlerrm not like '%ya tiene 10 fotos%' then raise; end if;
  end;

  v_json := montaigne_fix.admin_delete_ticket(v_fran, v_b);
  if v_json ? 'photoPath' then
    raise exception 'FALLO: admin_delete_ticket aún devuelve photoPath';
  end if;
  if exists (select 1 from montaigne_fix.tickets where id = v_b) then
    raise exception 'FALLO: el parte de prueba no se borró';
  end if;

  delete from montaigne_fix.tickets where id in (v_a, v_c);
  if exists (select 1 from montaigne_fix.ticket_photos where ticket_id in (v_a, v_c)) then
    raise exception 'FALLO: al borrar el parte no se fueron las fotos';
  end if;

  raise exception 'FOTOS_OK';
end $$;
