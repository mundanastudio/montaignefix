-- Al cerrar el original, los avisos unidos también quedan cerrados.
-- El trigger de escritura quita duplicate_of al dejar de estar en duplicado.

create function montaigne_fix.close_linked_duplicates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cerrado' and (tg_op = 'INSERT' or old.status is distinct from 'cerrado') then
    update montaigne_fix.tickets
    set status = 'cerrado'
    where duplicate_of = new.id
      and status = 'duplicado';
  end if;
  return new;
end;
$$;

create trigger tickets_close_linked
after insert or update of status on montaigne_fix.tickets
for each row execute function montaigne_fix.close_linked_duplicates();

revoke all on function montaigne_fix.close_linked_duplicates() from public, anon, authenticated;
grant execute on function montaigne_fix.close_linked_duplicates() to service_role;
