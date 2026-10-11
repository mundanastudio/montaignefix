import { handle, json } from "../_shared/http.ts"
import { runScheduledReports } from "../_shared/report.ts"

function authorized(req: Request): boolean {
  const expected = Deno.env.get("REPORT_CRON_SECRET") ?? ""
  const got = req.headers.get("x-report-secret") ?? ""
  if (!expected || expected.length !== got.length) return false
  let diff = 0
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ got.charCodeAt(index)
  return diff === 0
}

Deno.serve((req) =>
  handle(req, async () => {
    if (!authorized(req)) return json(401, { ok: false, message: "No autorizado." })
    return json(200, { ok: true, ...(await runScheduledReports()) })
  }),
)
