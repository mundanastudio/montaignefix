-- Carlos entra en Gestión con contraseña propia. No es técnico.
alter table montaigne_fix.session_versions drop constraint if exists session_versions_credential_check;

alter table montaigne_fix.session_versions
  add constraint session_versions_credential_check
  check (credential = 'pin' or credential ~ '^[a-z][a-z0-9_-]{1,30}$');

insert into montaigne_fix.staff (slug, name, full_name, email, is_manager, is_technician)
values ('carlos', 'Carlos', null, 'carlosjperezfernandez@gmail.com', true, false)
on conflict (slug) do update
set name          = excluded.name,
    email         = excluded.email,
    is_manager    = excluded.is_manager,
    is_technician = excluded.is_technician,
    active        = true;

insert into montaigne_fix.session_versions (credential)
values ('carlos')
on conflict (credential) do nothing;
