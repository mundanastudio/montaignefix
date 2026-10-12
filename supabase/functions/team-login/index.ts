import { assertConfigured, assertNotLocked, pinLength, recordAttempt, signToken, technicians, verifySecret } from "../_shared/auth.ts"
import { clientIp, handle, json, readJson, text } from "../_shared/http.ts"

Deno.serve((req) =>
  handle(req, async () => {
    const pin = text((await readJson(req)).pin).trim()
    const length = pinLength()
    if (!new RegExp(`^\\d{${length}}$`).test(pin)) {
      return json(400, { ok: false, message: length === 6 ? "El PIN tiene 6 dígitos." : "El PIN tiene 4 dígitos." })
    }

    const hash = await assertConfigured(Deno.env.get("MF_TEAM_PIN_HASH"))
    const ip = clientIp(req)
    await assertNotLocked("pin", ip)
    const valid = await verifySecret(pin, hash)
    await recordAttempt("pin", ip, valid)
    if (!valid) return json(401, { ok: false, message: "El PIN no es correcto." })

    return json(200, { ok: true, gate: await signToken("gate"), people: await technicians() })
  }),
)
