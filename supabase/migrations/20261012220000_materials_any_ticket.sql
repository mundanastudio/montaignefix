-- Materiales: el equipo puede añadir, editar y borrar en cualquier parte abierto.
-- En cerrado / rechazado / duplicado el equipo solo lee. Gestión sigue pudiendo cambiarlos.
-- Si el artículo ya no está pendiente, el mensaje pide recargar la ficha.

create or replace function montaigne_fix.staff_add_materials(p_actor uuid, p_ticket uuid, p_lines text[])
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_line text;
  v_added int := 0;
  v_status montaigne_fix.ticket_status;
begin
  v_name := montaigne_fix.assert_technician(p_actor);
  perform montaigne_fix.require_ticket(p_ticket);

  select status into v_status from montaigne_fix.tickets where id = p_ticket;
  if v_status in ('cerrado', 'rechazado', 'duplicado') then
    raise exception 'MF: En un parte cerrado, rechazado o duplicado no se pueden cambiar los materiales.';
  end if;

  if p_lines is null or cardinality(p_lines) = 0 then
    raise exception 'MF: Escribe al menos un artículo, uno por línea.';
  end if;
  if cardinality(p_lines) > 40 then
    raise exception 'MF: Puedes enviar hasta 40 artículos a la vez.';
  end if;

  foreach v_line in array p_lines loop
    v_line := btrim(coalesce(v_line, ''));
    if v_line = '' then
      continue;
    end if;
    if char_length(v_line) > 200 then
      raise exception 'MF: Cada artículo puede tener como máximo 200 caracteres.';
    end if;

    insert into montaigne_fix.shopping_items (ticket_id, description, requested_by)
    values (p_ticket, v_line, p_actor);

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, new_value)
    values (p_ticket, 'material_solicitado', p_actor, v_name, v_line);

    v_added := v_added + 1;
  end loop;

  if v_added = 0 then
    raise exception 'MF: Escribe al menos un artículo, uno por línea.';
  end if;

  return '{}'::jsonb;
end;
$$;

create or replace function montaigne_fix.staff_edit_material(p_actor uuid, p_id uuid, p_description text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
  v_text text := btrim(coalesce(p_description, ''));
  v_status montaigne_fix.ticket_status;
begin
  v_name := montaigne_fix.assert_technician(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  select status into v_status from montaigne_fix.tickets where id = v_item.ticket_id;
  if v_status in ('cerrado', 'rechazado', 'duplicado') then
    raise exception 'MF: En un parte cerrado, rechazado o duplicado no se pueden cambiar los materiales.';
  end if;

  if char_length(v_text) < 1 or char_length(v_text) > 200 then
    raise exception 'MF: El artículo debe tener entre 1 y 200 caracteres.';
  end if;

  if v_text is distinct from v_item.description then
    update montaigne_fix.shopping_items
    set description = v_text
    where id = p_id and status = 'pendiente';

    if not found then
      raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
    end if;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (v_item.ticket_id, 'material_editado', p_actor, v_name, v_item.description, v_text);
  end if;

  return '{}'::jsonb;
end;
$$;

create or replace function montaigne_fix.staff_delete_material(p_actor uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
  v_status montaigne_fix.ticket_status;
begin
  v_name := montaigne_fix.assert_technician(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  select status into v_status from montaigne_fix.tickets where id = v_item.ticket_id;
  if v_status in ('cerrado', 'rechazado', 'duplicado') then
    raise exception 'MF: En un parte cerrado, rechazado o duplicado no se pueden cambiar los materiales.';
  end if;

  delete from montaigne_fix.shopping_items where id = p_id and status = 'pendiente';

  if not found then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value)
  values (v_item.ticket_id, 'material_borrado', p_actor, v_name, v_item.description);

  return '{}'::jsonb;
end;
$$;

create or replace function montaigne_fix.admin_edit_material(p_actor uuid, p_id uuid, p_description text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
  v_text text := btrim(coalesce(p_description, ''));
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  if char_length(v_text) < 1 or char_length(v_text) > 200 then
    raise exception 'MF: El artículo debe tener entre 1 y 200 caracteres.';
  end if;

  if v_text is distinct from v_item.description then
    update montaigne_fix.shopping_items
    set description = v_text
    where id = p_id and status = 'pendiente';

    if not found then
      raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
    end if;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (v_item.ticket_id, 'material_editado', p_actor, v_name, v_item.description, v_text);
  end if;

  return montaigne_fix.ticket_counts();
end;
$$;

create or replace function montaigne_fix.admin_delete_material(p_actor uuid, p_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_name text;
  v_item montaigne_fix.shopping_items%rowtype;
begin
  v_name := montaigne_fix.assert_manager(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  delete from montaigne_fix.shopping_items where id = p_id and status = 'pendiente';

  if not found then
    raise exception 'MF: Este material ya se ha comprado o se ha borrado. Recarga la ficha.';
  end if;

  insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value)
  values (v_item.ticket_id, 'material_borrado', p_actor, v_name, v_item.description);

  return montaigne_fix.ticket_counts();
end;
$$;

revoke all on function montaigne_fix.staff_add_materials(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_edit_material(uuid, uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.staff_delete_material(uuid, uuid) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_edit_material(uuid, uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_delete_material(uuid, uuid) from public, anon, authenticated;
grant execute on function montaigne_fix.staff_add_materials(uuid, uuid, text[]) to service_role;
grant execute on function montaigne_fix.staff_edit_material(uuid, uuid, text) to service_role;
grant execute on function montaigne_fix.staff_delete_material(uuid, uuid) to service_role;
grant execute on function montaigne_fix.admin_edit_material(uuid, uuid, text) to service_role;
grant execute on function montaigne_fix.admin_delete_material(uuid, uuid) to service_role;
