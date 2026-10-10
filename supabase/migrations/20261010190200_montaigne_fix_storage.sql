-- ============================================================================
-- Montaigne Fix · 3/4 · Bucket privado de fotos
-- Solo las Edge Functions (service_role, que ignora RLS) suben y firman URLs.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'montaigne-fix-fotos',
  'montaigne-fix-fotos',
  false,
  2097152, -- 2 MB; el navegador comprime a < 500 KB
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Políticas RESTRICTIVAS: niegan a anon/authenticated cualquier operación sobre
-- este bucket aunque otra herramienta del mismo proyecto cree políticas
-- permisivas en storage. No afectan a los demás buckets.
create policy "montaigne_fix_fotos_sin_acceso_cliente"
on storage.objects
as restrictive
for all
to anon, authenticated
using (bucket_id <> 'montaigne-fix-fotos')
with check (bucket_id <> 'montaigne-fix-fotos');

create policy "montaigne_fix_bucket_oculto"
on storage.buckets
as restrictive
for all
to anon, authenticated
using (id <> 'montaigne-fix-fotos')
with check (id <> 'montaigne-fix-fotos');
