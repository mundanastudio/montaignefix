import { rpc, serveAdmin } from "../_shared/admin.ts"

serveAdmin((staff) => rpc("admin_shopping_list", { p_actor: staff.id }))
