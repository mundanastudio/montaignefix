-- Gestión puede cerrar un parte abierto sin pasar por Resuelto.
-- En rechazado o duplicado hay que reabrir antes. Si ya está cerrado, no hace nada.

create or replace function montaigne_fix.admin_set_status(
  p_actor uuid,
  p_ticket uuid,
  p_status text,
  p_duplicate_code text
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_current montaigne_fix.ticket_status;
  v_assigned uuid;
  v_other uuid;
  v_next montaigne_fix.ticket_status;
begin
  perform montaigne_fix.assert_manager(p_actor);

  select status, assigned_to into v_current, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  if p_status = 'reabrir' then
    if v_current not in ('cerrado', 'rechazado', 'duplicado') then
      raise exception 'MF: Solo se reabre una incidencia cerrada, rechazada o duplicada.';
    end if;
    v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    update montaigne_fix.tickets set status = v_next where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'cerrado' then
    if v_current in ('rechazado', 'duplicado') then
      raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
    end if;
    if v_current <> 'cerrado' then
      update montaigne_fix.tickets set status = 'cerrado' where id = p_ticket;
    end if;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'duplicado' then
    select id into v_other
    from montaigne_fix.tickets
    where code = upper(btrim(coalesce(p_duplicate_code, '')));

    if v_other is null then
      raise exception 'MF: No encontramos la incidencia original.';
    end if;
    if v_other = p_ticket then
      raise exception 'MF: Una incidencia no puede ser duplicado de sí misma.';
    end if;

    update montaigne_fix.tickets
    set status = 'duplicado', duplicate_of = v_other
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status not in ('en_curso', 'en_espera', 'resuelto', 'rechazado') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;

  if v_current in ('cerrado', 'rechazado', 'duplicado') and p_status <> 'rechazado' then
    raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
  end if;

  if v_current::text = p_status then
    return montaigne_fix.ticket_counts();
  end if;

  update montaigne_fix.tickets
  set status = p_status::montaigne_fix.ticket_status
  where id = p_ticket;

  return montaigne_fix.ticket_counts();
end;
$$;

revoke all on function montaigne_fix.admin_set_status(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function montaigne_fix.admin_set_status(uuid, uuid, text, text) to service_role;
