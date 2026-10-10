import { loadStaff, requireToken, signToken, technicians } from "../_shared/auth.ts"
import { handle, json, readJson, text } from "../_shared/http.ts"

Deno.serve((req) =>
  handle(req, async () => {
    await requireToken(req, ["gate", "team"])
    const slug = text((await readJson(req)).slug)
    const staff = await loadStaff(slug)
    if (!staff?.is_technician) return json(400, { ok: false, message: "Esa persona no está en el equipo." })
    return json(200, {
      ok: true,
      token: await signToken("team", staff.slug),
      person: { slug: staff.slug, name: staff.name },
      people: await technicians(),
    })
  }),
)
