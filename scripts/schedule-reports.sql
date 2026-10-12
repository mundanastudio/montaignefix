-- Programa el aviso horario. Solo envía cuando en Madrid son las 8:00 o más
-- y el periodo de ese día todavía no se ha enviado. El secreto está en vault.
create extension if not exists pg_cron;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('montaigne-fix-report-tick');
exception
  when others then null;
end $$;

select cron.schedule(
  'montaigne-fix-report-tick',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://rnghppmuqbdpbkkljnsr.supabase.co/functions/v1/report-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-report-secret', coalesce((
        select decrypted_secret from vault.decrypted_secrets where name = 'report_cron_secret' limit 1
      ), '')
    ),
    body := '{"source":"cron"}'::jsonb
  )
  where exists (
    select 1 from vault.decrypted_secrets where name = 'report_cron_secret'
  );
  $$
);
