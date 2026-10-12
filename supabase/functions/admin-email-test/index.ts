import { serveAdmin } from "../_shared/admin.ts"
import { listEmails, sendClosedSample, sendRejectedSample } from "../_shared/email.ts"
import { db } from "../_shared/http.ts"

serveAdmin(async (staff) => {
  const { data } = await db().from("staff").select("email, name").eq("id", staff.id).maybeSingle()
  const to = typeof data?.email === "string" ? data.email : ""
  const name = typeof data?.name === "string" ? data.name : staff.name
  const closed = await sendClosedSample(to, name)
  const rejected = await sendRejectedSample(to, name)
  const sent = closed.ok && rejected.ok
  const emailError = closed.error ?? rejected.error
  return { sent, emailError, emails: await listEmails() }
})
