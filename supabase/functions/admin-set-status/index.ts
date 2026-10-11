import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { notifyClosed, notifyResolved } from "../_shared/email.ts"
import { HttpError, text } from "../_shared/http.ts"

const ALLOWED = new Set(["en_curso", "en_espera", "resuelto", "cerrado", "rechazado", "duplicado", "reabrir"])

serveAdmin(async (staff, body) => {
  const status = text(body.status)
  if (!ALLOWED.has(status)) throw new HttpError(400, { ok: false, message: "Ese cambio de estado no está permitido." })
  const ticketId = uuid(body.ticketId)
  const result = await rpc("admin_set_status", {
    p_actor: staff.id,
    p_ticket: ticketId,
    p_status: status,
    p_duplicate_code: text(body.duplicateCode) || null,
  })
  if (status === "resuelto") await notifyResolved(ticketId, staff.id, staff.name)
  if (status === "cerrado") await notifyClosed(ticketId)
  return result
})
