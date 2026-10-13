// Mete las plantillas en un módulo que el empaquetador de Edge Functions sí incluye.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "functions", "_shared")
const dir = join(root, "email-templates")
const files = [
  ["recibido.html", "recibidoHtml"],
  ["recibido.txt", "recibidoTxt"],
  ["fran-nuevo.html", "franNuevoHtml"],
  ["fran-nuevo.txt", "franNuevoTxt"],
  ["fran-resuelto.html", "franResueltoHtml"],
  ["fran-resuelto.txt", "franResueltoTxt"],
  ["cerrado.html", "cerradoHtml"],
  ["cerrado.txt", "cerradoTxt"],
  ["rechazado.html", "rechazadoHtml"],
  ["rechazado.txt", "rechazadoTxt"],
  ["duplicado.html", "duplicadoHtml"],
  ["duplicado.txt", "duplicadoTxt"],
]
const body = files
  .map(([name, key]) => {
    return `export const ${key} = ${JSON.stringify(readFileSync(join(dir, name), "utf8"))}\n`
  })
  .join("\n")
writeFileSync(join(root, "email-bodies.ts"), `/* Generado por scripts/bundle-email-templates.mjs. No editar a mano. */\n${body}`)
