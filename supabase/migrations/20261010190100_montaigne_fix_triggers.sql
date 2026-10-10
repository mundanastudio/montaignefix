-- ============================================================================
-- Montaigne Fix · 2/4 · Triggers: fechas automáticas e historial (ticket_events)
--
-- Quién hizo el cambio: las Edge Functions escribirán mediante funciones SQL que
-- llaman primero a montaigne_fix.set_actor(<staff_id>) dentro de la MISMA
-- transacción. Sin actor, el cambio se registra como 'Sistema' (o 'Solicitante'
-- al crear el parte).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Actor de la transacción actual
-- ---------------------------------------------------------------------------
create function montaigne_fix.set_actor(p_staff_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select set_config('montaigne_fix.actor_id', coalesce(p_staff_id::text, ''), true);
$$;

create function montaigne_fix.current_actor()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('montaigne_fix.actor_id', true), '')::uuid;
$$;

create function montaigne_fix.staff_name(p_staff_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select name from montaigne_fix.staff where id = p_staff_id;
$$;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT/UPDATE en tickets: coherencia de estado y fechas
-- ---------------------------------------------------------------------------
create function montaigne_fix.tickets_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  terminal montaigne_fix.ticket_status[] := array['cerrado', 'rechazado', 'duplicado']::montaigne_fix.ticket_status[];
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();

    -- Asignación
    if new.assigned_to is distinct from old.assigned_to then
      new.assigned_at := case when new.assigned_to is null then null else now() end;
      -- Sin técnico, una tarea en marcha vuelve a la cola
      if new.assigned_to is null and new.status in ('en_curso', 'en_espera') then
        new.status := 'nuevo';
      end if;
    end if;
  elsif new.assigned_to is not null then
    new.assigned_at := coalesce(new.assigned_at, now());
  end if;

  -- Invariante Nuevo/Asignado (cubre asignar, quitar y reabrir)
  if new.status = 'nuevo' and new.assigned_to is not null then
    new.status := 'asignado';
  elsif new.status = 'asignado' and new.assigned_to is null then
    new.status := 'nuevo';
  end if;

  if new.status <> 'duplicado' then
    new.duplicate_of := null;
  end if;

  -- Fechas de resolución y cierre
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'resuelto' then
      new.resolved_at := now();
      new.closed_at := null;
    elsif new.status = 'cerrado' then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.closed_at := now();
    elsif new.status = any (terminal) then -- rechazado / duplicado
      new.closed_at := now();
    else
      -- Reapertura o vuelta atrás: la incidencia deja de estar resuelta/cerrada.
      -- Las fechas anteriores quedan en ticket_events.
      new.resolved_at := null;
      new.closed_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger tickets_before_write
before insert or update on montaigne_fix.tickets
for each row execute function montaigne_fix.tickets_before_write();

-- ---------------------------------------------------------------------------
-- AFTER INSERT/UPDATE en tickets: historial
-- ---------------------------------------------------------------------------
create function montaigne_fix.tickets_log_events()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := montaigne_fix.current_actor();
  v_label text := coalesce(
    montaigne_fix.staff_name(v_actor),
    case when tg_op = 'INSERT' then 'Solicitante' else 'Sistema' end
  );
begin
  if tg_op = 'INSERT' then
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (new.id, 'creado', v_actor, v_label, new.status::text);

    if new.priority is not null then
      insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
      values (new.id, 'prioridad', v_actor, v_label, new.priority::text);
    end if;

    if new.assigned_to is not null then
      insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
      values (new.id, 'asignacion', v_actor, v_label, montaigne_fix.staff_name(new.assigned_to));
    end if;

    return null;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (new.id, 'asignacion', v_actor, v_label,
            montaigne_fix.staff_name(old.assigned_to), montaigne_fix.staff_name(new.assigned_to));
  end if;

  if new.status is distinct from old.status then
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (new.id, 'estado', v_actor, v_label, old.status::text, new.status::text);
  end if;

  if new.priority is distinct from old.priority then
    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (new.id, 'prioridad', v_actor, v_label, old.priority::text, new.priority::text);
  end if;

  return null;
end;
$$;

create trigger tickets_log_events
after insert or update on montaigne_fix.tickets
for each row execute function montaigne_fix.tickets_log_events();

-- ---------------------------------------------------------------------------
-- AFTER INSERT en ticket_notes: la nota también queda en el historial
-- ---------------------------------------------------------------------------
create function montaigne_fix.notes_log_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
  values (new.ticket_id, 'nota', new.author_id,
          coalesce(montaigne_fix.staff_name(new.author_id), 'Sistema'), new.kind::text);
  return null;
end;
$$;

create trigger ticket_notes_log_event
after insert on montaigne_fix.ticket_notes
for each row execute function montaigne_fix.notes_log_event();

-- ---------------------------------------------------------------------------
-- Historial y notas inmutables (solo se borran con su incidencia, a los 12 meses)
-- ---------------------------------------------------------------------------
create function montaigne_fix.forbid_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% es de solo escritura: no se puede modificar', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger ticket_events_no_update
before update on montaigne_fix.ticket_events
for each row execute function montaigne_fix.forbid_update();

create trigger ticket_notes_no_update
before update on montaigne_fix.ticket_notes
for each row execute function montaigne_fix.forbid_update();

-- ---------------------------------------------------------------------------
-- Permisos de las funciones nuevas (EXECUTE se concede a PUBLIC por defecto)
-- ---------------------------------------------------------------------------
revoke all on all functions in schema montaigne_fix from public, anon, authenticated;
grant execute on all functions in schema montaigne_fix to service_role;
