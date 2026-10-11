// Comprueba que la clave pública no lee ni escribe datos y que las funciones
// rechazan una llamada sin token o con un token que no es de ese rol.
// No imprime la clave ni el cuerpo de las respuestas.
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=")
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)

const root = env.VITE_SUPABASE_URL?.replace(/\/$/, "")
const key = env.VITE_SUPABASE_ANON_KEY
if (!root || !key) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local")
  process.exit(1)
}

async function call(label, path, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(root + path, { method, headers, body })
  const text = await res.text()
  const row = /"requester_email"|"photo_path"|"MF-\d+"/i.test(text)
  const snippet = text.replaceAll(key, "[clave]").slice(0, 140).replace(/\s+/g, " ")
  console.log(`${label}\t${res.status}\t${row ? "FILA" : "sin_fila"}\t${snippet}`)
}

const rest = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Accept-Profile": "montaigne_fix",
  "Content-Profile": "montaigne_fix",
  "Content-Type": "application/json",
}

await call("rest tickets GET", "/rest/v1/tickets?select=code&limit=1", { headers: rest })
await call("rest tickets POST", "/rest/v1/tickets", {
  method: "POST",
  headers: { ...rest, Prefer: "return=minimal" },
  body: JSON.stringify({ requester_name: "x", requester_email: "x@x.com", description: "x", location: "x" }),
})
await call("rest rpc admin_assign", "/rest/v1/rpc/admin_assign", {
  method: "POST",
  headers: rest,
  body: "{}",
})
await call("storage public", "/storage/v1/object/public/montaigne-fix-fotos/no-existe.jpg", { headers: { apikey: key } })
await call("storage sin firma", "/storage/v1/object/montaigne-fix-fotos/no-existe.jpg", { headers: { apikey: key, Authorization: `Bearer ${key}` } })

const fn = (token) => ({
  method: "POST",
  headers: {
    apikey: key,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: "{}",
})

await call("admin-tickets sin token", "/functions/v1/admin-tickets", fn())
await call("admin-tickets anon", "/functions/v1/admin-tickets", fn(key))
await call("staff-set-status token ajeno", "/functions/v1/staff-set-status", fn("e30.e30"))
await call("admin-mark-purchased sin token", "/functions/v1/admin-mark-purchased", fn())
await call("staff-photo sin token", "/functions/v1/staff-ticket", fn())

const photo = process.env.MF_PHOTO
if (photo) {
  await call("foto real publica", `/storage/v1/object/public/montaigne-fix-fotos/${photo}`, { headers: { apikey: key } })
  await call("foto real sin firma", `/storage/v1/object/montaigne-fix-fotos/${photo}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
}
await call("listar cubo", "/storage/v1/object/list/montaigne-fix-fotos", {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: "{\"prefix\":\"\"}",
})
