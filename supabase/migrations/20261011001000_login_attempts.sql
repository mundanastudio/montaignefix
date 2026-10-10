-- ============================================================================
-- Montaigne Fix · Intentos de PIN y contraseña
-- 5 fallos seguidos bloquean 15 minutos. El PIN se cuenta por IP;
-- cada contraseña, por persona. No guarda el PIN ni la contraseña.
-- ============================================================================

create table montaigne_fix.login_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('pin', 'password')),
  subject    text not null check (char_length(subject) between 1 and 200),
  success    boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_lookup_idx
  on montaigne_fix.login_attempts (kind, subject, created_at desc);

alter table montaigne_fix.login_attempts enable row level security;

revoke all on montaigne_fix.login_attempts from public, anon, authenticated;
grant all on montaigne_fix.login_attempts to service_role;
