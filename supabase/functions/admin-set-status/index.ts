import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { listLinkedDuplicates, notifyClosed, notifyDuplicated, notifyRejected, notifyResolved } from "../_shared/email.ts"
import { HttpError, text } from "../_shared/http.ts"

const ALLOWED = new Set(["en_curso", "en_espera", "resuelto", "cerrado", "rechazado", "duplicado", "quitar_duplicado", "reabrir"])

serveAdmin(async (staff, body) => {
  const status = text(body.status)
  if (!ALLOWED.has(status)) throw new HttpError(400, { ok: false, message: "Ese cambio de estado no está permitido." })
  const ticketId = uuid(body.ticketId)
  const reason = text(body.reason).trim()
  const linked = status === "cerrado" ? await listLinkedDuplicates(ticketId) : []
  const result = await rpc("admin_set_status", {
    p_actor: staff.id,
    p_ticket: ticketId,
    p_status: status,
    p_duplicate_code: text(body.duplicateCode) || null,
    p_reason: reason || null,
  })
  if (status === "resuelto" && result.applied === "resuelto") await notifyResolved(ticketId, staff.id, staff.name)
  if (status === "cerrado") {
    const mail = await notifyClosed(ticketId, linked)
    return { ...result, emailError: mail.error }
  }
  if (status === "duplicado") {
    const mail = await notifyDuplicated(ticketId)
    return { ...result, emailError: mail.error }
  }
  if (status === "rechazado") {
    const mail = await notifyRejected(ticketId, reason)
    return { ...result, emailError: mail.error }
  }
  return result
})
