-- ============================================================================
-- Montaigne Fix · 1/4 · Schema, tipos, tablas, índices, permisos y RLS
-- Todo vive en el schema propio `montaigne_fix`.
-- El navegador NO accede a nada: solo `service_role` (Edge Functions) tiene permisos.
-- ============================================================================

create schema if not exists montaigne_fix;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type montaigne_fix.ticket_status as enum (
  'nuevo', 'asignado', 'en_curso', 'en_espera', 'resuelto', 'cerrado', 'rechazado', 'duplicado'
);

create type montaigne_fix.ticket_priority as enum ('p1', 'p2', 'p3');

create type montaigne_fix.note_kind as enum ('gestion', 'interna');

create type montaigne_fix.event_type as enum ('creado', 'estado', 'prioridad', 'asignacion', 'nota');

-- ---------------------------------------------------------------------------
-- Código legible MF-0001
-- ---------------------------------------------------------------------------
create sequence montaigne_fix.ticket_code_seq start 1;

create function montaigne_fix.next_ticket_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- lpad recortaría a partir de MF-10000, por eso solo rellena hasta 4 cifras
  select 'MF-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end
  from (select nextval('montaigne_fix.ticket_code_seq') as n) s;
$$;

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table montaigne_fix.staff (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z][a-z0-9_-]{1,30}$'),
  name          text not null check (char_length(name) between 1 and 60),
  full_name     text check (char_length(full_name) <= 120),
  email         text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_manager    boolean not null default false,
  is_technician boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (is_manager or is_technician)
);

comment on table montaigne_fix.staff is 'Gerentes y equipo de mantenimiento. PIN y contraseñas NO se guardan aquí (secretos del servidor).';

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------
create table montaigne_fix.tickets (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default montaigne_fix.next_ticket_code(),
  requester_name  text not null check (char_length(btrim(requester_name)) between 1 and 120),
  requester_email text not null check (
    char_length(requester_email) <= 254 and requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  description     text not null check (char_length(btrim(description)) between 1 and 2000),
  location        text not null check (char_length(btrim(location)) between 1 and 200),
  requester_notes text check (char_length(requester_notes) <= 2000),
  photo_path      text check (char_length(photo_path) <= 300),
  status          montaigne_fix.ticket_status not null default 'nuevo',
  priority        montaigne_fix.ticket_priority, -- null = sin priorizar
  assigned_to     uuid references montaigne_fix.staff (id) on delete restrict,
  duplicate_of    uuid references montaigne_fix.tickets (id) on delete set null,
  created_at      timestamptz not null default now(),
  assigned_at     timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz, -- también para rechazado/duplicado: fecha de salida del flujo
  updated_at      timestamptz not null default now(),
  check (duplicate_of is null or (status = 'duplicado' and duplicate_of <> id))
);

comment on column montaigne_fix.tickets.description is 'Reparación necesaria (texto del solicitante).';
comment on column montaigne_fix.tickets.photo_path is 'Ruta dentro del bucket privado montaigne-fix-fotos. Nunca base64.';
comment on column montaigne_fix.tickets.closed_at is 'Fecha de cierre, rechazo o duplicado. Base del borrado a 12 meses.';

create index tickets_status_idx      on montaigne_fix.tickets (status);
create index tickets_priority_idx    on montaigne_fix.tickets (priority);
create index tickets_assigned_to_idx on montaigne_fix.tickets (assigned_to);
create index tickets_created_at_idx  on montaigne_fix.tickets (created_at desc);
create index tickets_resolved_at_idx on montaigne_fix.tickets (resolved_at) where resolved_at is not null;
create index tickets_closed_at_idx   on montaigne_fix.tickets (closed_at) where closed_at is not null;
create index tickets_duplicate_of_idx on montaigne_fix.tickets (duplicate_of) where duplicate_of is not null;

-- ---------------------------------------------------------------------------
-- ticket_events (historial; fuente de verdad para fechas e informes)
-- ---------------------------------------------------------------------------
create table montaigne_fix.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references montaigne_fix.tickets (id) on delete cascade,
  event_type  montaigne_fix.event_type not null,
  actor_id    uuid references montaigne_fix.staff (id) on delete set null,
  actor_label text not null, -- copia del nombre: 'Agustín', 'Solicitante', 'Sistema'
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

create index ticket_events_ticket_idx  on montaigne_fix.ticket_events (ticket_id, created_at);
create index ticket_events_created_idx on montaigne_fix.ticket_events (created_at);
create index ticket_events_actor_idx   on montaigne_fix.ticket_events (actor_id);

-- ---------------------------------------------------------------------------
-- ticket_notes (observaciones de gestión e internas)
-- ---------------------------------------------------------------------------
create table montaigne_fix.ticket_notes (
  id         bigint generated always as identity primary key,
  ticket_id  uuid not null references montaigne_fix.tickets (id) on delete cascade,
  kind       montaigne_fix.note_kind not null,
  author_id  uuid not null references montaigne_fix.staff (id) on delete restrict,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index ticket_notes_ticket_idx on montaigne_fix.ticket_notes (ticket_id, created_at);
create index ticket_notes_author_idx on montaigne_fix.ticket_notes (author_id);

-- ---------------------------------------------------------------------------
-- RLS: activado en todas las tablas y SIN políticas → anon/authenticated no ven nada.
-- service_role tiene BYPASSRLS.
-- ---------------------------------------------------------------------------
alter table montaigne_fix.staff         enable row level security;
alter table montaigne_fix.tickets       enable row level security;
alter table montaigne_fix.ticket_events enable row level security;
alter table montaigne_fix.ticket_notes  enable row level security;

-- ---------------------------------------------------------------------------
-- Permisos: segunda barrera. Nadie salvo service_role puede tocar el schema.
-- ---------------------------------------------------------------------------
revoke all on schema montaigne_fix from public, anon, authenticated;
revoke all on all tables    in schema montaigne_fix from public, anon, authenticated;
revoke all on all sequences in schema montaigne_fix from public, anon, authenticated;
revoke all on all functions in schema montaigne_fix from public, anon, authenticated;

alter default privileges in schema montaigne_fix revoke all on tables    from public, anon, authenticated;
alter default privileges in schema montaigne_fix revoke all on sequences from public, anon, authenticated;
alter default privileges in schema montaigne_fix revoke all on functions from public, anon, authenticated;

grant usage on schema montaigne_fix to service_role;
grant all on all tables    in schema montaigne_fix to service_role;
grant all on all sequences in schema montaigne_fix to service_role;
grant execute on all functions in schema montaigne_fix to service_role;

alter default privileges in schema montaigne_fix grant all on tables    to service_role;
alter default privileges in schema montaigne_fix grant all on sequences to service_role;
alter default privileges in schema montaigne_fix grant execute on functions to service_role;
