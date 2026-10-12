import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { HttpError } from "../_shared/http.ts"
import { listTicketPhotoPaths, removeStorage } from "../_shared/photos.ts"

serveAdmin(async (staff, body) => {
  const ticketId = uuid(body.ticketId)
  const paths = await listTicketPhotoPaths(ticketId)
  const gone = await removeStorage(paths)
  if (!gone.ok) {
    throw new HttpError(500, { ok: false, message: "No se han podido borrar las fotos. El parte no se ha eliminado." })
  }
  return rpc("admin_delete_ticket", { p_actor: staff.id, p_ticket: ticketId })
})
