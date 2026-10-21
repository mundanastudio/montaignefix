import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { listLinkedDuplicates, notifyClosed, notifyDuplicated, notifyRejected, notifyResolved } from "../_shared/email.ts"
import { HttpError, text } from "../_shared/http.ts"

const ALLOWED = new Set(["en_curso", "en_espera", "resuelto", "cerrado", "rechazado", "duplicado", "quitar_duplicado", "reabrir"])
const CLOSE_MESSAGE_MAX = 500

serveAdmin(async (staff, body) => {
  const status = text(body.status)
  if (!ALLOWED.has(status)) throw new HttpError(400, { ok: false, message: "Ese cambio de estado no está permitido." })
  const ticketId = uuid(body.ticketId)
  const reason = text(body.reason).trim()
  const closeMessage = text(body.message).trim()
  if (status === "cerrado" && closeMessage.length > CLOSE_MESSAGE_MAX) {
    throw new HttpError(400, { ok: false, message: `Las observaciones no pueden pasar de ${CLOSE_MESSAGE_MAX} caracteres.` })
  }
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
    const mail = await notifyClosed(ticketId, linked, closeMessage)
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
