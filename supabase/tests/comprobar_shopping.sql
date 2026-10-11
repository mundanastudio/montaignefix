-- Comprueba shopping_items DESPUÉS de aplicar 20261011010000_shopping_items.sql.
-- Pega este archivo en Supabase → SQL Editor → Run. No modifica datos.
-- Las cuatro filas deben decir OK.

do $$
declare
  r text;
  roles text[] := array['anon', 'authenticated'];
  res text[] := array[]::text[];
  i int;
begin
  create temp table if not exists resultado_shopping (n int, rol text, prueba text, resultado text, detalle text);
  truncate resultado_shopping;

  if to_regclass('montaigne_fix.shopping_items') is null then
    raise exception 'Falta la tabla montaigne_fix.shopping_items. Aplica antes la migración.';
  end if;

  foreach r in array roles loop
    execute format('set local role %I', r);

    begin
      perform 1 from montaigne_fix.shopping_items limit 1;
      res := res || array[r, 'Leer materiales', 'FALLO', 'Se ha podido leer'];
    exception
      when undefined_table then
        res := res || array[r, 'Leer materiales', 'FALLO', 'La tabla shopping_items no existe'];
      when others then
        res := res || array[r, 'Leer materiales', 'OK', sqlerrm];
    end;

    begin
      insert into montaigne_fix.shopping_items (ticket_id, description, requested_by)
      values ('00000000-0000-0000-0000-000000000000', 'Prueba de seguridad', '00000000-0000-0000-0000-000000000000');
      raise exception using errcode = 'P0001', message = '__insert_ok__';
    exception
      when undefined_table then
        res := res || array[r, 'Crear material', 'FALLO', 'La tabla shopping_items no existe'];
      when others then
        if sqlerrm = '__insert_ok__' then
          res := res || array[r, 'Crear material', 'FALLO', 'Se ha podido insertar (deshecho)'];
        else
          res := res || array[r, 'Crear material', 'OK', sqlerrm];
        end if;
    end;

    reset role;
  end loop;

  for i in 1 .. array_length(res, 1) / 4 loop
    insert into resultado_shopping values (i, res[i*4-3], res[i*4-2], res[i*4-1], res[i*4]);
  end loop;
end $$;

select rol, prueba, resultado, detalle from resultado_shopping order by n;
