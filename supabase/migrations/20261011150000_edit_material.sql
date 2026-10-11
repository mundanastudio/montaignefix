-- Corregir el texto de un material pendiente. El comprado no se toca.
-- El valor nuevo del enum se usa al ejecutar la función, no en esta migración.

alter type montaigne_fix.event_type add value if not exists 'material_editado';

create function montaigne_fix.staff_edit_material(p_actor uuid, p_id uuid, p_description text)
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
  v_name := montaigne_fix.assert_technician(p_actor);

  select * into v_item
  from montaigne_fix.shopping_items
  where id = p_id
  for update;

  if not found or v_item.status <> 'pendiente' or v_item.requested_by is distinct from p_actor then
    raise exception 'MF: Solo puedes editar un material que hayas pedido tú y que siga pendiente.';
  end if;

  perform montaigne_fix.lock_own_ticket(p_actor, v_item.ticket_id);

  if char_length(v_text) < 1 or char_length(v_text) > 200 then
    raise exception 'MF: El artículo debe tener entre 1 y 200 caracteres.';
  end if;

  if v_text is distinct from v_item.description then
    update montaigne_fix.shopping_items
    set description = v_text
    where id = p_id and status = 'pendiente' and requested_by = p_actor;

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (v_item.ticket_id, 'material_editado', p_actor, v_name, v_item.description, v_text);
  end if;

  return '{}'::jsonb;
end;
$$;

create function montaigne_fix.admin_edit_material(p_actor uuid, p_id uuid, p_description text)
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
    raise exception 'MF: Solo se puede editar un artículo que siga pendiente.';
  end if;

  if char_length(v_text) < 1 or char_length(v_text) > 200 then
    raise exception 'MF: El artículo debe tener entre 1 y 200 caracteres.';
  end if;

  if v_text is distinct from v_item.description then
    update montaigne_fix.shopping_items
    set description = v_text
    where id = p_id and status = 'pendiente';

    insert into montaigne_fix.ticket_events (ticket_id, event_type, actor_id, actor_label, old_value, new_value)
    values (v_item.ticket_id, 'material_editado', p_actor, v_name, v_item.description, v_text);
  end if;

  return montaigne_fix.ticket_counts();
end;
$$;

revoke all on function montaigne_fix.staff_edit_material(uuid, uuid, text) from public, anon, authenticated;
revoke all on function montaigne_fix.admin_edit_material(uuid, uuid, text) from public, anon, authenticated;
grant execute on function montaigne_fix.staff_edit_material(uuid, uuid, text) to service_role;
grant execute on function montaigne_fix.admin_edit_material(uuid, uuid, text) to service_role;
