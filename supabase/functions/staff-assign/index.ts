import { optionalUuid, rpc, uuid } from "../_shared/admin.ts"
import { serveTeam } from "../_shared/staff.ts"
import { HttpError, text } from "../_shared/http.ts"

const MODES = new Set(["tomar", "soltar", "reasignar"])

serveTeam((staff, body) => {
  const mode = text(body.mode)
  if (!MODES.has(mode)) throw new HttpError(400, { ok: false, message: "Esa asignación no está permitida." })
  return rpc("staff_assign", {
    p_actor: staff.id,
    p_ticket: uuid(body.ticketId),
    p_mode: mode,
    p_staff: optionalUuid(body.staffId),
  })
})
