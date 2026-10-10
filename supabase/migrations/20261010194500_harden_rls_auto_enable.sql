-- ============================================================================
-- Montaigne Fix · Endurecimiento: public.rls_auto_enable()
-- Supabase crea esta función (event trigger "ensure_rls") al activar
-- "Enable automatic RLS" al crear el proyecto. Los event triggers no necesitan
-- EXECUTE del rol que lanza el DDL, así que quitarlo no cambia su funcionamiento
-- y elimina el aviso del Security Advisor (RPC expuesta a anon/authenticated).
-- ============================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
