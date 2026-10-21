import assert from "node:assert/strict"
import test from "node:test"
import { CLOSE_MESSAGE_MAX, closeMessageReady, trimmedCloseMessage } from "../src/domain/closeMessage.ts"

test("las observaciones de cierre son opcionales y se recortan", () => {
  assert.equal(trimmedCloseMessage("  hola  "), "hola")
  assert.equal(closeMessageReady(""), true)
  assert.equal(closeMessageReady("   "), true)
  assert.equal(closeMessageReady("a".repeat(CLOSE_MESSAGE_MAX)), true)
  assert.equal(closeMessageReady("a".repeat(CLOSE_MESSAGE_MAX + 1)), false)
  assert.equal(closeMessageReady(`  ${"a".repeat(CLOSE_MESSAGE_MAX)}  `), true)
})
