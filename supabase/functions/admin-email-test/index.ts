import { serveAdmin } from "../_shared/admin.ts"
import { listEmails, sendClosedSample } from "../_shared/email.ts"
import { db } from "../_shared/http.ts"

serveAdmin(async (staff) => {
  const { data } = await db().from("staff").select("email, name").eq("id", staff.id).maybeSingle()
  const to = typeof data?.email === "string" ? data.email : ""
  const name = typeof data?.name === "string" ? data.name : staff.name
  const result = await sendClosedSample(to, name)
  return { sent: result.ok, emailError: result.error, emails: await listEmails() }
})
