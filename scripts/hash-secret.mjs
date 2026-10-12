// Genera el hash para un secreto de Supabase. No imprime el PIN ni la contraseña.
// Uso: MF_SECRET se lee del entorno (así no queda en el historial de comandos).
//   node scripts/hash-secret.mjs pin
//   node scripts/hash-secret.mjs password
import { pbkdf2Sync, randomBytes } from "node:crypto"

const kind = process.argv[2]
const secret = process.env.MF_SECRET ?? ""

if (kind === "session") {
  process.stdout.write(`${randomBytes(32).toString("hex")}\n`)
  process.exit(0)
}

if (kind !== "pin" && kind !== "password") {
  console.error("Indica qué vas a hashear: pin o password")
  process.exit(1)
}
if (!secret) {
  console.error("Falta MF_SECRET. Míralo en el README: no lo escribas en la misma línea del comando.")
  process.exit(1)
}
if (kind === "pin" && !/^(\d{4}|\d{6})$/.test(secret)) {
  console.error("El PIN tiene que ser de 4 o de 6 dígitos.")
  process.exit(1)
}
if (kind === "password" && [...secret].length < 8) {
  console.error("La contraseña tiene que tener al menos 8 caracteres.")
  process.exit(1)
}

const iterations = 600_000
const salt = randomBytes(16)
const hash = pbkdf2Sync(secret, salt, iterations, 32, "sha256")
process.stdout.write(`pbkdf2_sha256$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}\n`)
