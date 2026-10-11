import { lines, rpc, serveAdmin, uuid } from "../_shared/admin.ts"

serveAdmin((staff, body) =>
  rpc("admin_add_materials", {
    p_actor: staff.id,
    p_ticket: uuid(body.ticketId),
    p_lines: lines(body.text),
  }),
)
