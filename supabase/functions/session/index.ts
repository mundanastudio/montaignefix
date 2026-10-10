import { loadStaff, requireToken, technicians } from "../_shared/auth.ts"
import { handle, json, text } from "../_shared/http.ts"

Deno.serve((req) =>
  handle(req, async () => {
    const payload = await requireToken(req, ["team", "admin"])
    const staff = await loadStaff(text(payload.sub))
    const allowed = payload.typ === "team" ? staff?.is_technician : staff?.is_manager
    if (!staff || !allowed) return json(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
    return json(200, {
      ok: true,
      session: { kind: payload.typ, slug: staff.slug, name: staff.name },
      people: payload.typ === "team" ? await technicians() : undefined,
    })
  }),
)
