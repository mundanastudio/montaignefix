-- Informes semanal y anual, y el borrado a 12 meses. No edita migraciones ya aplicadas.

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
  check (kind in ('nuevo', 'recibido', 'resuelto', 'cerrado', 'prueba', 'informe'));

create table montaigne_fix.report_runs (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('semanal', 'anual', 'purga')),
  period_key  text not null,
  period_end  timestamptz,
  ok          boolean not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create unique index report_runs_success_idx
  on montaigne_fix.report_runs (kind, period_key)
  where ok;

alter table montaigne_fix.report_runs enable row level security;
revoke all on montaigne_fix.report_runs from public, anon, authenticated;
grant all on montaigne_fix.report_runs to service_role;
grant usage, select on sequence montaigne_fix.report_runs_id_seq to service_role;
