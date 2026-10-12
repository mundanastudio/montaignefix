import { bumpTeamSessions } from "../_shared/auth.ts"
import { serveAdmin } from "../_shared/admin.ts"

serveAdmin(async () => {
  await bumpTeamSessions()
  return { closed: true }
})
