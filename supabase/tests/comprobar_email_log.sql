-- El rol anon no puede leer ni escribir el registro de correos.
do $$
declare
  v_read text := 'NO';
  v_write text := 'NO';
begin
  begin
    execute 'set role anon';
    begin
      perform 1 from montaigne_fix.email_log;
      v_read := 'LEYO';
    exception
      when insufficient_privilege then v_read := 'OK';
      when others then
        if sqlerrm ilike '%permission denied%' then v_read := 'OK'; else v_read := sqlerrm; end if;
    end;
    begin
      insert into montaigne_fix.email_log (kind, recipient, subject, ok)
      values ('prueba', 'nadie@example.com', 'no', false);
      v_write := 'ESCRIBIO';
    exception
      when insufficient_privilege then v_write := 'OK';
      when others then
        if sqlerrm ilike '%permission denied%' then v_write := 'OK'; else v_write := sqlerrm; end if;
    end;
    execute 'reset role';
  exception
    when others then
      execute 'reset role';
      raise;
  end;
  raise exception 'EMAIL_LOG lectura=% escritura=%', v_read, v_write;
end $$;
