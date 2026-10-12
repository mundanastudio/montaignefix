-- El advisor marca pg_net porque está instalada en public.
-- No se puede mover con ALTER EXTENSION. El cron guarda el SQL como texto
-- y sigue llamando a net.http_post; esta migración no toca cron.job.

create schema if not exists extensions;

drop extension if exists pg_net;
create extension pg_net with schema extensions;
