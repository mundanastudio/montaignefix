import { rpc, serveAdmin } from "../_shared/admin.ts"
import { HttpError, text } from "../_shared/http.ts"

function day(value: unknown): string | null {
  const date = text(value).trim()
  if (!date) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, { ok: false, message: "La fecha no es válida." })
  return date
}

serveAdmin(async (staff, body) => {
  if (body.countsOnly === true) return rpc("admin_counts", { p_actor: staff.id })
  return rpc("admin_list_tickets", {
    p_actor: staff.id,
    p_status: text(body.status) || null,
    p_priority: text(body.priority) || null,
    p_assigned: text(body.assigned) || null,
    p_from: day(body.from),
    p_to: day(body.to),
    p_query: text(body.query) || null,
  })
})
