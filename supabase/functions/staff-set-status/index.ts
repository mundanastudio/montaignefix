import { rpc, uuid } from "../_shared/admin.ts"
import { notifyResolved } from "../_shared/email.ts"
import { serveTeam } from "../_shared/staff.ts"
import { HttpError, text } from "../_shared/http.ts"

const ALLOWED = new Set(["en_curso", "en_espera", "resuelto"])

serveTeam(async (staff, body) => {
  const status = text(body.status)
  if (!ALLOWED.has(status)) throw new HttpError(400, { ok: false, message: "Ese cambio de estado no está permitido." })
  const ticketId = uuid(body.ticketId)
  const result = await rpc("staff_set_status", { p_actor: staff.id, p_ticket: ticketId, p_status: status })
  if (status === "resuelto" && result.applied === "resuelto") await notifyResolved(ticketId, staff.id, staff.name)
  return result
})
