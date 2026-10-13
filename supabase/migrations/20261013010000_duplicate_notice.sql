-- Email al marcar duplicado. El valor nuevo del enum se usa en la migración siguiente.

alter type montaigne_fix.event_type add value if not exists 'duplicado';

do $$
declare
  nombre text;
begin
  for nombre in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'montaigne_fix'
      and rel.relname = 'email_log'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table montaigne_fix.email_log drop constraint %I', nombre);
  end loop;
end $$;

alter table montaigne_fix.email_log
  add constraint email_log_kind_check
  check (kind in ('nuevo', 'recibido', 'resuelto', 'cerrado', 'rechazado', 'duplicado', 'prueba', 'informe', 'aviso'));
