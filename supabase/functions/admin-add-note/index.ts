import { rpc, serveAdmin, uuid } from "../_shared/admin.ts"
import { text } from "../_shared/http.ts"

serveAdmin((staff, body) =>
  rpc("admin_add_note", {
    p_actor: staff.id,
    p_ticket: uuid(body.ticketId),
    p_body: text(body.body),
  }),
)
