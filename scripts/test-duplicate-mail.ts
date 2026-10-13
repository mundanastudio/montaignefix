import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sameRequesterEmail, uniqueClosedRecipients } from "../supabase/functions/_shared/duplicateMail.ts"

describe("sameRequesterEmail", () => {
  it("trata el mismo correo con mayúsculas y espacios como el mismo", () => {
    assert.equal(sameRequesterEmail("  Ana@Colegio.es ", "ana@colegio.es"), true)
  })
  it("distingue dos personas", () => {
    assert.equal(sameRequesterEmail("ana@colegio.es", "luis@colegio.es"), false)
  })
  it("no une vacíos", () => {
    assert.equal(sameRequesterEmail("", ""), false)
  })
})

describe("uniqueClosedRecipients", () => {
  it("omite el email del original y no repite", () => {
    const picked = uniqueClosedRecipients("ana@colegio.es", [
      { requester_email: "ANA@colegio.es", code: "MF-0002" },
      { requester_email: "luis@colegio.es", code: "MF-0003" },
      { requester_email: "Luis@colegio.es", code: "MF-0004" },
      { requester_email: "eva@colegio.es", code: "MF-0005" },
    ])
    assert.deepEqual(
      picked.map((row) => row.code),
      ["MF-0003", "MF-0005"],
    )
  })
})
