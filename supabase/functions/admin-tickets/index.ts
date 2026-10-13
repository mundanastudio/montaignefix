import { rpc, serveAdmin } from "../_shared/admin.ts"
import { text } from "../_shared/http.ts"

serveAdmin(async (staff, body) => {
  if (body.countsOnly === true) return rpc("admin_counts", { p_actor: staff.id })
  return rpc("admin_list_tickets", {
    p_actor: staff.id,
    p_status: text(body.status) || null,
    p_priority: text(body.priority) || null,
    p_assigned: text(body.assigned) || null,
    p_from: null,
    p_to: null,
    p_query: text(body.query) || null,
    p_tab: text(body.tab) || "abiertas",
  })
})
