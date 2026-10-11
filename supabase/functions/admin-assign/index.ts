import { optionalUuid, rpc, serveAdmin, uuid } from "../_shared/admin.ts"

serveAdmin((staff, body) =>
  rpc("admin_assign", {
    p_actor: staff.id,
    p_ticket: uuid(body.ticketId),
    p_staff: optionalUuid(body.staffId),
  }),
)
