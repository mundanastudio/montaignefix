import { rpc, serveAdmin, signPhoto } from "../_shared/admin.ts"
import { HttpError, text } from "../_shared/http.ts"

serveAdmin(async (staff, body) => {
  const code = text(body.code).trim()
  if (!/^MF-\d+$/i.test(code)) throw new HttpError(400, { ok: false, message: "El código no es válido." })
  const result = await rpc("admin_ticket_detail", { p_actor: staff.id, p_code: code })
  const ticket = result.ticket
  if (ticket && typeof ticket === "object" && !Array.isArray(ticket)) {
    const row = ticket as Record<string, unknown>
    const hadPhoto = typeof row.photoPath === "string" && row.photoPath !== ""
    row.photoUrl = await signPhoto(row.photoPath)
    delete row.photoPath
    if (hadPhoto && !row.photoUrl) row.photoError = true
  }
  return result
})
