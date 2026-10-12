-- Varias fotos por parte. Copia las rutas actuales; no mueve archivos.
-- tickets.photo_path se queda (no se borra hasta confirmación).

create table montaigne_fix.ticket_photos (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references montaigne_fix.tickets (id) on delete cascade,
  path         text not null check (char_length(path) between 1 and 300),
  sort_order   smallint not null check (sort_order between 1 and 10),
  uploaded_by  uuid references montaigne_fix.staff (id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (path),
  unique (ticket_id, sort_order)
);

comment on table montaigne_fix.ticket_photos is
  'Fotos del parte. uploaded_by null = solicitante. Máximo 10 por parte.';
comment on column montaigne_fix.tickets.photo_path is
  'Antigua. Las fotos viven en ticket_photos. No borrar la columna hasta confirmación.';

create index ticket_photos_ticket_idx
  on montaigne_fix.ticket_photos (ticket_id, sort_order);

create table montaigne_fix.storage_orphans (
  id         bigint generated always as identity primary key,
  ticket_id  uuid,
  path       text not null check (char_length(path) between 1 and 300),
  created_at timestamptz not null default now()
);

comment on table montaigne_fix.storage_orphans is
  'Rutas que se borraron en la ficha pero Storage no las quitó. Para limpiar a mano.';

create function montaigne_fix.ticket_photos_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from montaigne_fix.ticket_photos
    where ticket_id = new.ticket_id
  ) >= 10 then
    raise exception 'MF: Este parte ya tiene 10 fotos.';
  end if;
  return new;
end;
$$;

create trigger ticket_photos_cap
before insert on montaigne_fix.ticket_photos
for each row execute function montaigne_fix.ticket_photos_cap();

insert into montaigne_fix.ticket_photos (ticket_id, path, sort_order, uploaded_by, created_at)
select t.id, t.photo_path, 1, null, t.created_at
from montaigne_fix.tickets t
where t.photo_path is not null
  and btrim(t.photo_path) <> ''
  and not exists (
    select 1 from montaigne_fix.ticket_photos p where p.path = t.photo_path
  );

alter table montaigne_fix.ticket_photos enable row level security;
alter table montaigne_fix.storage_orphans enable row level security;
revoke all on montaigne_fix.ticket_photos from public, anon, authenticated;
revoke all on montaigne_fix.storage_orphans from public, anon, authenticated;
revoke all on function montaigne_fix.ticket_photos_cap() from public, anon, authenticated;
grant all on montaigne_fix.ticket_photos to service_role;
grant all on montaigne_fix.storage_orphans to service_role;
grant execute on function montaigne_fix.ticket_photos_cap() to service_role;

alter type montaigne_fix.event_type add value if not exists 'foto_anadida';
alter type montaigne_fix.event_type add value if not exists 'foto_borrada';
