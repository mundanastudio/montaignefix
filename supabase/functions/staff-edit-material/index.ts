import { rpc, uuid } from "../_shared/admin.ts"
import { text } from "../_shared/http.ts"
import { serveTeam } from "../_shared/staff.ts"

serveTeam((staff, body) =>
  rpc("staff_edit_material", {
    p_actor: staff.id,
    p_id: uuid(body.id, "Ese artículo no es válido."),
    p_description: text(body.description),
  }),
)
