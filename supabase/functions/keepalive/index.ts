// Ping interno para que el plan gratuito no pause el proyecto.
// Solo con la cabecera x-keepalive-token. No crea partes, no manda correo, no lista datos.
import { db, handle, json } from "../_shared/http.ts"

function authorized(req: Request): boolean {
  const expected = Deno.env.get("KEEPALIVE_TOKEN") ?? ""
  const got = req.headers.get("x-keepalive-token") ?? ""
  if (!expected || expected.length !== got.length) return false
  let diff = 0
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ got.charCodeAt(index)
  }
  return diff === 0
}

Deno.serve((req) =>
  handle(req, async () => {
    if (!authorized(req)) return json(401, { ok: false, message: "No autorizado." })
    const { error } = await db().from("tickets").select("id", { count: "exact", head: true })
    if (error) {
      console.error("keepalive")
      return json(500, { ok: false, message: "No se ha podido completar. Inténtalo de nuevo." })
    }
    return json(200, { ok: true })
  }),
)
