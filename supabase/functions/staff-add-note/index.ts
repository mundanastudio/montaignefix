import { rpc, uuid } from "../_shared/admin.ts"
import { serveTeam } from "../_shared/staff.ts"
import { text } from "../_shared/http.ts"

serveTeam((staff, body) =>
  rpc("staff_add_note", { p_actor: staff.id, p_ticket: uuid(body.ticketId), p_body: text(body.body) }),
)
