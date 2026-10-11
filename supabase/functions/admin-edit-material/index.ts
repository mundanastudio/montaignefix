import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { text } from "../_shared/http.ts"

serveAdmin((staff, body) =>
  rpc("admin_edit_material", {
    p_actor: staff.id,
    p_id: uuid(body.id, "Ese artículo no es válido."),
    p_description: text(body.description),
  }),
)
