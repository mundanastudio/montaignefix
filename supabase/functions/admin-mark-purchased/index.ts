import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { HttpError } from "../_shared/http.ts"

serveAdmin((staff, body) => {
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    throw new HttpError(400, { ok: false, message: "Selecciona al menos un artículo." })
  }
  return rpc("admin_mark_purchased", {
    p_actor: staff.id,
    p_ids: body.ids.map((id) => uuid(id, "Hay un artículo que no es válido.")),
  })
})
