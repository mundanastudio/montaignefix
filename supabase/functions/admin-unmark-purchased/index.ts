import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"

serveAdmin((staff, body) =>
  rpc("admin_unmark_purchased", {
    p_actor: staff.id,
    p_id: uuid(body.id, "Ese artículo no es válido."),
  }),
)
