import { rpc } from "../_shared/admin.ts"
import { serveTeam } from "../_shared/staff.ts"
import { text } from "../_shared/http.ts"

serveTeam((staff, body) => rpc("staff_list_tickets", { p_actor: staff.id, p_tab: text(body.tab) || "mias" }))
