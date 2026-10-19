import { assertConfigured, assertNotLocked, loadStaff, passwordHash, recordAttempt, signToken, verifySecret } from "../_shared/auth.ts"
import { handle, json, readJson, text } from "../_shared/http.ts"

Deno.serve((req) =>
  handle(req, async () => {
    const body = await readJson(req)
    const slug = text(body.slug)
    const password = text(body.password)
    const staff = await loadStaff(slug)
    if (!staff?.is_manager) return json(400, { ok: false, message: "Elige quién eres." })
    if ([...password].length < 8) return json(400, { ok: false, message: "La contraseña tiene que tener al menos 8 caracteres." })

    const hash = await assertConfigured(passwordHash(staff.slug))
    await assertNotLocked("password", staff.slug)
    const valid = await verifySecret(password, hash)
    await recordAttempt("password", staff.slug, valid)
    if (!valid) return json(401, { ok: false, message: "La contraseña no es correcta." })

    return json(200, {
      ok: true,
      token: await signToken("admin", staff.slug),
      person: { slug: staff.slug, name: staff.name },
    })
  }),
)
