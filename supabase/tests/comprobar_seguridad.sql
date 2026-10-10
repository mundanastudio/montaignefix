-- ============================================================================
-- Montaigne Fix · Comprobación de seguridad (Fase 1)
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Hace cada prueba como los roles `anon` (la anon key del navegador) y
-- `authenticated`, y devuelve una tabla. Todas las filas deben decir "OK".
-- No modifica ningún dato.
-- ============================================================================

create temp table if not exists resultado_seguridad (n int, rol text, prueba text, resultado text, detalle text);
truncate resultado_seguridad;

do $$
declare
  r      text;
  roles  text[] := array['anon', 'authenticated'];
  res    text[] := '{}';
  n      int := 0;
begin
  foreach r in array roles loop
    execute format('set local role %I', r);

    -- 1. Leer tickets
    begin
      perform 1 from montaigne_fix.tickets limit 1;
      res := res || array[r, 'Leer tickets', 'FALLO', 'Se ha podido leer'];
    exception when others then
      res := res || array[r, 'Leer tickets', 'OK', sqlerrm];
    end;

    -- 2. Crear un ticket
    begin
      insert into montaigne_fix.tickets (requester_name, requester_email, description, location)
      values ('Prueba', 'prueba@ejemplo.com', 'Prueba de seguridad', 'Ninguno');
      raise exception using errcode = 'P0001', message = '__insert_ok__';
    exception when others then
      if sqlerrm = '__insert_ok__' then
        res := res || array[r, 'Crear ticket', 'FALLO', 'Se ha podido insertar (deshecho)'];
      else
        res := res || array[r, 'Crear ticket', 'OK', sqlerrm];
      end if;
    end;

    -- 3. Leer staff, historial y notas
    begin
      perform 1 from montaigne_fix.staff limit 1;
      res := res || array[r, 'Leer staff', 'FALLO', 'Se ha podido leer'];
    exception when others then
      res := res || array[r, 'Leer staff', 'OK', sqlerrm];
    end;

    begin
      perform 1 from montaigne_fix.ticket_events limit 1;
      res := res || array[r, 'Leer historial', 'FALLO', 'Se ha podido leer'];
    exception when others then
      res := res || array[r, 'Leer historial', 'OK', sqlerrm];
    end;

    begin
      perform 1 from montaigne_fix.ticket_notes limit 1;
      res := res || array[r, 'Leer notas', 'FALLO', 'Se ha podido leer'];
    exception when others then
      res := res || array[r, 'Leer notas', 'OK', sqlerrm];
    end;

    -- 4. Ejecutar funciones internas
    begin
      perform montaigne_fix.next_ticket_code();
      res := res || array[r, 'Ejecutar funciones', 'FALLO', 'Se ha podido ejecutar'];
    exception when others then
      res := res || array[r, 'Ejecutar funciones', 'OK', sqlerrm];
    end;

    -- 5. Ver el bucket de fotos
    begin
      if exists (select 1 from storage.buckets where id = 'montaigne-fix-fotos') then
        res := res || array[r, 'Ver bucket de fotos', 'FALLO', 'El bucket es visible'];
      else
        res := res || array[r, 'Ver bucket de fotos', 'OK', 'Bucket invisible'];
      end if;
    exception when others then
      res := res || array[r, 'Ver bucket de fotos', 'OK', sqlerrm];
    end;

    -- 6. Subir/listar fotos
    begin
      insert into storage.objects (bucket_id, name) values ('montaigne-fix-fotos', 'prueba-seguridad.jpg');
      raise exception using errcode = 'P0001', message = '__insert_ok__';
    exception when others then
      if sqlerrm = '__insert_ok__' then
        res := res || array[r, 'Subir foto', 'FALLO', 'Se ha podido subir (deshecho)'];
      else
        res := res || array[r, 'Subir foto', 'OK', sqlerrm];
      end if;
    end;

    begin
      if exists (select 1 from storage.objects where bucket_id = 'montaigne-fix-fotos') then
        res := res || array[r, 'Listar fotos', 'FALLO', 'Se ven fotos'];
      else
        res := res || array[r, 'Listar fotos', 'OK', 'Ninguna foto visible'];
      end if;
    exception when others then
      res := res || array[r, 'Listar fotos', 'OK', sqlerrm];
    end;

    reset role;
  end loop;

  for i in 1 .. array_length(res, 1) / 4 loop
    insert into resultado_seguridad values (i, res[i*4-3], res[i*4-2], res[i*4-1], res[i*4]);
  end loop;
end $$;

select rol, prueba, resultado, detalle from resultado_seguridad order by n;
