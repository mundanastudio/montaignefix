-- Registro de correos. Si el envío falla, el parte no se deshace:
-- la función lo apunta aquí y gestión lo enseña.

create table montaigne_fix.email_log (
  id          bigint generated always as identity primary key,
  ticket_id   uuid references montaigne_fix.tickets (id) on delete set null,
  kind        text not null check (kind in ('nuevo', 'resuelto', 'cerrado', 'prueba')),
  recipient   text not null,
  subject     text not null,
  ok          boolean not null,
  error       text,
  created_at  timestamptz not null default now()
);

create index email_log_created_idx on montaigne_fix.email_log (created_at desc);

alter table montaigne_fix.email_log enable row level security;
revoke all on montaigne_fix.email_log from public, anon, authenticated;
grant all on montaigne_fix.email_log to service_role;
grant usage, select on sequence montaigne_fix.email_log_id_seq to service_role;
