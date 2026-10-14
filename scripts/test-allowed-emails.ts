import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  EMAIL_DOMAIN_MESSAGE,
  EMAIL_LIMIT_MESSAGE,
  isAllowedRequesterEmail,
  isRaisedRequesterEmail,
  isUnlimitedRequesterEmail,
  normalizeEmail,
  requesterEmailFieldError,
  requesterEmailTicketLimit,
} from "../supabase/functions/_shared/allowedEmails.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("normalizeEmail", () => {
  it("quita espacios y pasa a minúsculas", () => {
    assert.equal(normalizeEmail("  Juan@GrupoMontaigne.com "), "juan@grupomontaigne.com")
  })
})

describe("isAllowedRequesterEmail", () => {
  const allowed = [
    "profe@grupomontaignesevilla.com",
    "profe@colegiomontaignesevilla.com",
    "profe@grupomontaigne.com",
    "profe@mundana.us",
    "PROFE@GRUPOMONTAIGNE.COM",
    "  profe@grupomontaigne.com  ",
    "curromena89@gmail.com",
    "  CurroMena89@Gmail.com ",
    "andrescanorodriguez@gmail.com",
    "  AndresCanoRodriguez@Gmail.com ",
    "agumasero@gmail.com",
    "  AguMasero@Gmail.com ",
    "patriciacastilloorozco33@gmail.com",
    "Susanacrespomarquez@gmail.com",
    "Remelucia78@gmail.com",
    "16.11.96.maria@gmail.com",
    "Scmary97@gmail.com",
  ]
  for (const email of allowed) {
    it(`acepta ${JSON.stringify(email)}`, () => {
      assert.equal(isAllowedRequesterEmail(email), true)
    })
  }

  const blocked = [
    "otro@gmail.com",
    "nombre@grupomontaigne.com.falso.com",
    "profe@sub.grupomontaigne.com",
    "profe@sub.colegiomontaignesevilla.com",
    "sinarroba",
    "a@",
    "@grupomontaigne.com",
    "profe@",
    "",
  ]
  for (const email of blocked) {
    it(`rechaza ${JSON.stringify(email)}`, () => {
      assert.equal(isAllowedRequesterEmail(email), false)
    })
  }
})

describe("isUnlimitedRequesterEmail", () => {
  it("solo esos dos Gmail saltan el tope; Curro no va en esta lista", () => {
    assert.equal(isUnlimitedRequesterEmail("andrescanorodriguez@gmail.com"), true)
    assert.equal(isUnlimitedRequesterEmail("  AguMasero@Gmail.com "), true)
    assert.equal(isUnlimitedRequesterEmail("curromena89@gmail.com"), false)
    assert.equal(isUnlimitedRequesterEmail("otro@gmail.com"), false)
    assert.equal(isUnlimitedRequesterEmail("profe@grupomontaigne.com"), false)
    assert.equal(isUnlimitedRequesterEmail("scmary97@gmail.com"), false)
  })
})

describe("isRaisedRequesterEmail", () => {
  it("esos cinco Gmail tienen tope 10, no ilimitado", () => {
    assert.equal(isRaisedRequesterEmail("  ScMary97@Gmail.com "), true)
    assert.equal(isRaisedRequesterEmail("16.11.96.maria@gmail.com"), true)
    assert.equal(requesterEmailTicketLimit("patriciacastilloorozco33@gmail.com"), 10)
    assert.equal(requesterEmailTicketLimit("andrescanorodriguez@gmail.com"), null)
    assert.equal(requesterEmailTicketLimit("profe@grupomontaigne.com"), 3)
    assert.equal(isRaisedRequesterEmail("andrescanorodriguez@gmail.com"), false)
    assert.equal(isRaisedRequesterEmail("otro@gmail.com"), false)
  })
})

describe("mensajes", () => {
  it("el dominio inválido usa el texto del formulario", () => {
    assert.equal(requesterEmailFieldError("otro@gmail.com"), EMAIL_DOMAIN_MESSAGE)
    assert.equal(EMAIL_DOMAIN_MESSAGE, "Debes utilizar un correo corporativo del Grupo Montaigne")
  })

  it("create-ticket usa el mensaje de 24 h y el de dominio, no el texto viejo", () => {
    const src = readFileSync(join(root, "supabase/functions/create-ticket/index.ts"), "utf8")
    assert.match(src, /EMAIL_LIMIT_MESSAGE/)
    assert.match(src, /requesterEmailFieldError/)
    assert.match(src, /isUnlimitedRequesterEmail/)
    assert.match(src, /isRaisedRequesterEmail/)
    assert.match(src, /requesterEmailTicketLimit/)
    assert.equal(EMAIL_LIMIT_MESSAGE, "Debes esperar 24h para poder abrir un parte nuevo")
    assert.doesNotMatch(src, /Con este email ya hay/)
    assert.doesNotMatch(src, /Podrás abrir otro el/)
    assert.match(src, /Has enviado muchos partes seguidos\. Inténtalo de nuevo en un rato\./)
  })

  it("no hay una segunda lista en src/domain que se haya desincronizado", () => {
    const duplicate = join(root, "src/domain/allowedEmails.ts")
    try {
      readFileSync(duplicate)
    } catch {
      return
    }
    const shared = readFileSync(join(root, "supabase/functions/_shared/allowedEmails.ts"), "utf8")
    assert.equal(readFileSync(duplicate, "utf8"), shared)
  })
})
