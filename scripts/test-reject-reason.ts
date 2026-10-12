import assert from "node:assert/strict"
import test from "node:test"
import { reasonReady, trimmedReason } from "../src/domain/rejectReason.ts"

test("el motivo se cuenta y se guarda recortado", () => {
  assert.equal(trimmedReason("  hola  "), "hola")
  assert.equal(reasonReady(""), false)
  assert.equal(reasonReady("  corto  "), false)
  assert.equal(reasonReady("         a"), false)
  assert.equal(reasonReady(`  ${"a".repeat(10)}  `), true)
  assert.equal(reasonReady("a".repeat(9)), false)
  assert.equal(reasonReady("a".repeat(10)), true)
  assert.equal(reasonReady("a".repeat(500)), true)
  assert.equal(reasonReady("a".repeat(501)), false)
  assert.equal(reasonReady(`  ${"a".repeat(500)}  `), true)
  assert.equal(reasonReady(`  ${"a".repeat(501)}  `), false)
})
