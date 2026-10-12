-- Versión de sesión, topes del formulario y avisos de seguridad.
-- La huella no es el hash del PIN ni de la contraseña: es un HMAC corto.

create table montaigne_fix.session_versions (
  credential   text primary key check (credential in ('pin', 'fran', 'curro')),
  version      integer not null default 1 check (version > 0),
  fingerprint  text not null default '' check (char_length(fingerprint) <= 64),
  updated_at   timestamptz not null default now()
);

insert into montaigne_fix.session_versions (credential) values ('pin'), ('fran'), ('curro');

alter table montaigne_fix.session_versions enable row level security;
revoke all on montaigne_fix.session_versions from public, anon, authenticated;
grant all on montaigne_fix.session_versions to service_role;

create table montaigne_fix.submission_ips (
  id         bigint generated always as identity primary key,
  ip         text not null check (char_length(ip) between 1 and 64),
  created_at timestamptz not null default now()
);

create index submission_ips_ip_idx on montaigne_fix.submission_ips (ip, created_at desc);
create index submission_ips_created_idx on montaigne_fix.submission_ips (created_at desc);

alter table montaigne_fix.submission_ips enable row level security;
revoke all on montaigne_fix.submission_ips from public, anon, authenticated;
grant all on montaigne_fix.submission_ips to service_role;
grant usage, select on sequence montaigne_fix.submission_ips_id_seq to service_role;

create table montaigne_fix.security_notices (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('pin_lock', 'password_lock', 'ticket_flood')),
  created_at timestamptz not null default now()
);

create index security_notices_kind_idx on montaigne_fix.security_notices (kind, created_at desc);

alter table montaigne_fix.security_notices enable row level security;
revoke all on montaigne_fix.security_notices from public, anon, authenticated;
grant all on montaigne_fix.security_notices to service_role;
grant usage, select on sequence montaigne_fix.security_notices_id_seq to service_role;

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
  check (kind in ('nuevo', 'recibido', 'resuelto', 'cerrado', 'prueba', 'informe', 'aviso'));
