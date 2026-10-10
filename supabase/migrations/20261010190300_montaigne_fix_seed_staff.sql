-- ============================================================================
-- Montaigne Fix · 4/4 · Datos semilla del staff
-- Se puede volver a ejecutar sin duplicar (upsert por slug).
-- Agustín y Andrés no tienen email: no reciben correos (les avisa Fran).
-- ============================================================================

insert into montaigne_fix.staff (slug, name, full_name, email, is_manager, is_technician)
values
  ('fran',    'Fran',    'Francisco Flores', 'Francisco.flores@grupomontaigne.com', true,  true),
  ('agustin', 'Agustín', null,               null,                                  false, true),
  ('andres',  'Andrés',  null,               null,                                  false, true),
  ('curro',   'Curro',   null,               'curromena89@gmail.com',               true,  false)
on conflict (slug) do update
set name          = excluded.name,
    full_name     = coalesce(excluded.full_name, montaigne_fix.staff.full_name),
    email         = coalesce(excluded.email, montaigne_fix.staff.email),
    is_manager    = excluded.is_manager,
    is_technician = excluded.is_technician;
