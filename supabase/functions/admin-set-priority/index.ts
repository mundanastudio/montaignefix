import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { HttpError, text } from "../_shared/http.ts"

serveAdmin(async (staff, body) => {
  const priority = text(body.priority)
  if (priority !== "p1" && priority !== "p2" && priority !== "p3") {
    throw new HttpError(400, { ok: false, message: "Elige P1, P2 o P3." })
  }
  return rpc("admin_set_priority", { p_actor: staff.id, p_ticket: uuid(body.ticketId), p_priority: priority })
})
