import { serveAdmin } from "../_shared/admin.ts"
import { sendWeeklyNow } from "../_shared/report.ts"

serveAdmin(async () => {
  const result = await sendWeeklyNow()
  return { sent: result.ok, emailError: result.error }
})
