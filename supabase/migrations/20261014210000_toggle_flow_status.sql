-- Pulsar otra vez En curso / En espera / Resuelto vuelve a Asignado (o Nuevo).

create or replace function montaigne_fix.staff_set_status(p_actor uuid, p_ticket uuid, p_status text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_status montaigne_fix.ticket_status;
  v_applied text;
begin
  perform montaigne_fix.assert_technician(p_actor);
  v_status := montaigne_fix.lock_own_ticket(p_actor, p_ticket);

  if p_status not in ('en_curso', 'en_espera', 'resuelto') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;
  if v_status in ('cerrado', 'rechazado', 'duplicado') then
    raise exception 'MF: Esta incidencia ya está cerrada. Solo gerencia puede reabrirla.';
  end if;

  if v_status::text = p_status then
    update montaigne_fix.tickets
    set status = 'asignado'
    where id = p_ticket;
    v_applied := 'asignado';
  else
    update montaigne_fix.tickets
    set status = p_status::montaigne_fix.ticket_status
    where id = p_ticket;
    v_applied := p_status;
  end if;

  return jsonb_build_object('applied', v_applied);
end;
$$;

create or replace function montaigne_fix.admin_set_status(
  p_actor uuid,
  p_ticket uuid,
  p_status text,
  p_duplicate_code text,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_current montaigne_fix.ticket_status;
  v_assigned uuid;
  v_other uuid;
  v_other_status montaigne_fix.ticket_status;
  v_next montaigne_fix.ticket_status;
  v_prev text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_original text;
  v_applied text;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select status, assigned_to into v_current, v_assigned
  from montaigne_fix.tickets
  where id = p_ticket
  for update;

  if not found then
    raise exception 'MF: No encontramos esa incidencia.' using errcode = 'P0002';
  end if;

  if p_status = 'quitar_duplicado' then
    if v_current <> 'duplicado' then
      raise exception 'MF: Esa incidencia no está marcada como duplicado.';
    end if;
    select e.old_value into v_prev
    from montaigne_fix.ticket_events e
    where e.ticket_id = p_ticket
      and e.event_type = 'estado'
      and e.new_value = 'duplicado'
    order by e.created_at desc, e.id desc
    limit 1;
    if v_prev in ('nuevo', 'asignado', 'en_curso', 'en_espera', 'resuelto', 'cerrado', 'rechazado') then
      v_next := v_prev::montaigne_fix.ticket_status;
    else
      v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    end if;
    update montaigne_fix.tickets
    set status = v_next, rejection_reason = case when v_next = 'rechazado' then rejection_reason else null end
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'reabrir' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current not in ('cerrado', 'rechazado') then
      raise exception 'MF: Solo se reabre una incidencia cerrada o rechazada.';
    end if;
    v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    update montaigne_fix.tickets
    set status = v_next, rejection_reason = null
    where id = p_ticket;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'cerrado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current = 'rechazado' then
      raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
    end if;
    if v_current <> 'cerrado' then
      update montaigne_fix.tickets set status = 'cerrado' where id = p_ticket;
    end if;
    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'duplicado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if v_current in ('cerrado', 'rechazado') then
      raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
    end if;
    v_original := upper(btrim(coalesce(p_duplicate_code, '')));
    if v_original = '' then
      raise exception 'MF: Elige el parte original al que unirlo.';
    end if;

    select id, status into v_other, v_other_status
    from montaigne_fix.tickets
    where code = v_original;

    if v_other is null then
      raise exception 'MF: No encontramos la incidencia original.';
    end if;
    if v_other = p_ticket then
      raise exception 'MF: Una incidencia no puede ser duplicado de sí misma.';
    end if;
    if v_other_status in ('cerrado', 'rechazado', 'duplicado') then
      raise exception 'MF: El parte original tiene que estar abierto.';
    end if;

    update montaigne_fix.tickets
    set status = 'duplicado', duplicate_of = v_other, rejection_reason = null
    where id = p_ticket;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'duplicado', p_actor, v_name, v_original);

    return montaigne_fix.ticket_counts();
  end if;

  if p_status = 'rechazado' then
    if v_current = 'duplicado' then
      raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
    end if;
    if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
      raise exception 'MF: Escribe el motivo del rechazo (entre 10 y 500 caracteres).';
    end if;

    update montaigne_fix.tickets
    set status = 'rechazado', rejection_reason = v_reason
    where id = p_ticket;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'rechazo', p_actor, v_name, v_reason);

    return montaigne_fix.ticket_counts();
  end if;

  if p_status not in ('en_curso', 'en_espera', 'resuelto') then
    raise exception 'MF: Ese cambio de estado no está permitido.';
  end if;

  if v_current = 'duplicado' then
    raise exception 'MF: Quita el duplicado para devolver el parte a como estaba.';
  end if;
  if v_current in ('cerrado', 'rechazado') then
    raise exception 'MF: Reabre la incidencia antes de cambiar el estado.';
  end if;

  if v_current::text = p_status then
    v_next := case when v_assigned is null then 'nuevo' else 'asignado' end;
    update montaigne_fix.tickets set status = v_next where id = p_ticket;
    v_applied := v_next::text;
  else
    update montaigne_fix.tickets
    set status = p_status::montaigne_fix.ticket_status
    where id = p_ticket;
    v_applied := p_status;
  end if;

  return montaigne_fix.ticket_counts() || jsonb_build_object('applied', v_applied);
end;
$$;

revoke all on function montaigne_fix.staff_set_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_set_status(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function montaigne_fix.staff_set_status(uuid, uuid, text) to service_role;
grant execute on function montaigne_fix.admin_set_status(uuid, uuid, text, text, text) to service_role;
