// Panel del equipo. Quién actúa lo fija la función SQL, en la misma transacción.
import { type Staff, requirePerson } from "./auth.ts"
import { handle, json, readJson } from "./http.ts"

export function serveTeam(run: (staff: Staff, body: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  Deno.serve((req) =>
    handle(req, async () => {
      const staff = await requirePerson(req, "team", "is_technician")
      return json(200, { ok: true, ...(await run(staff, await readJson(req))) })
    }),
  )
}
