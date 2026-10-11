-- ============================================================================
-- Montaigne Fix · Lista de la compra
-- No modifica migraciones anteriores. Los valores nuevos del enum de eventos
-- no se usan en este archivo: PostgreSQL no deja usar un valor recién añadido
-- dentro de la misma transacción.
-- ============================================================================

create type montaigne_fix.material_status as enum ('pendiente', 'comprado');

alter type montaigne_fix.event_type add value 'material_solicitado';
alter type montaigne_fix.event_type add value 'material_comprado';
alter type montaigne_fix.event_type add value 'material_repuesto';
alter type montaigne_fix.event_type add value 'material_borrado';

create table montaigne_fix.shopping_items (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references montaigne_fix.tickets (id) on delete cascade,
  description   text not null check (char_length(btrim(description)) between 1 and 200),
  status        montaigne_fix.material_status not null default 'pendiente',
  requested_by  uuid not null references montaigne_fix.staff (id) on delete restrict,
  created_at    timestamptz not null default now(),
  purchased_by  uuid references montaigne_fix.staff (id) on delete restrict,
  purchased_at  timestamptz,
  check (
    (status = 'pendiente' and purchased_by is null and purchased_at is null)
    or
    (status = 'comprado' and purchased_by is not null and purchased_at is not null)
  )
);

comment on table montaigne_fix.shopping_items is
  'Un registro por artículo. Comprado es borrado lógico; borrar un pendiente es físico y lo harán las Edge Functions.';
comment on column montaigne_fix.shopping_items.requested_by is
  'staff.id de quien lo pidió, tomado del token de sesión (equipo o gerencia).';
comment on column montaigne_fix.shopping_items.purchased_by is
  'staff.id de quien lo marcó comprado. Solo gerencia.';

create index shopping_items_status_created_idx on montaigne_fix.shopping_items (status, created_at);
create index shopping_items_ticket_idx on montaigne_fix.shopping_items (ticket_id);

alter table montaigne_fix.shopping_items enable row level security;

revoke all on montaigne_fix.shopping_items from public, anon, authenticated;
grant all on montaigne_fix.shopping_items to service_role;
