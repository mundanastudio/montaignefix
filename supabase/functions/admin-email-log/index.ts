import { serveAdmin } from "../_shared/admin.ts"
import { listEmails } from "../_shared/email.ts"

serveAdmin(async () => ({ emails: await listEmails() }))
