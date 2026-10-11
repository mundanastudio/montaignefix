import { lines, rpc, uuid } from "../_shared/admin.ts"
import { serveTeam } from "../_shared/staff.ts"

serveTeam((staff, body) =>
  rpc("staff_add_materials", {
    p_actor: staff.id,
    p_ticket: uuid(body.ticketId),
    p_lines: lines(body.text),
  }),
)
