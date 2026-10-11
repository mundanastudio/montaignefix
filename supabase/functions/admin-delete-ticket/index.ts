import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { admin } from "../_shared/http.ts"

serveAdmin(async (staff, body) => {
  const result = await rpc("admin_delete_ticket", { p_actor: staff.id, p_ticket: uuid(body.ticketId) })
  const path = typeof result.photoPath === "string" ? result.photoPath : ""
  if (path) {
    const removed = await admin().storage.from("montaigne-fix-fotos").remove([path])
    if (removed.error) console.error("foto", removed.error.message)
  }
  return result
})
