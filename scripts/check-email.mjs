import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  clip,
  duracion,
  escapeHtml,
  fechaConHora,
  fechaLarga,
  render,
  subjectFranNuevo,
  subjectFranResuelto,
  subjectRecibido,
  subjectSolucionado,
} from "../supabase/functions/_shared/email-render.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dir = join(root, "supabase", "functions", "_shared", "email-templates")
const assets = join(root, "assets", "email")

const nasty = `Ana <script>alert(1)</script> & "patio"`
const cerradoVars = {
  nombre: nasty,
  codigo: "MF-0042",
  reparacion: "La puerta <b>no</b> cierra {{lugar}}",
  lugar: "Patio & jardín",
  fecha_apertura: fechaLarga("2026-10-12T10:00:00.000Z"),
  fecha_cierre: fechaLarga("2026-10-15T10:00:00.000Z"),
  url_formulario: "https://ejemplo.pages.dev/",
  url_assets: "https://ejemplo.pages.dev/email",
}

const html = readFileSync(join(dir, "cerrado.html"), "utf8")
const rendered = render(html, cerradoVars, true)
assert.equal(rendered.includes("<script>"), false)
assert.equal(rendered.includes("&lt;script&gt;"), true)
assert.equal(rendered.includes("{{lugar}}"), true, "una variable escrita por el usuario no se vuelve a sustituir")
assert.equal(rendered.includes("{{nombre}}"), false)
assert.equal(rendered.includes("Patio &amp; jardín"), true)
assert.equal(rendered.includes("12 de octubre de 2026"), true)
assert.equal(rendered.includes("15 de octubre de 2026"), true)
assert.equal(rendered.includes("https://ejemplo.pages.dev/email/montaigne-fix-logo.png"), true)

const plain = render(readFileSync(join(dir, "cerrado.txt"), "utf8"), cerradoVars, false)
assert.equal(plain.includes("<script>"), true)
assert.equal(plain.includes("&lt;"), false)

assert.equal(subjectRecibido("MF-0042"), "Hemos recibido tu solicitud MF-0042")
assert.equal(subjectFranNuevo("MF-0042", "a".repeat(80), "Patio"), `Nuevo parte MF-0042: ${"a".repeat(60)} · Patio`)
assert.equal(subjectFranResuelto("Fran", "MF-0042", "a".repeat(80)), `Fran ha resuelto MF-0042: ${"a".repeat(60)}`)
assert.equal(subjectSolucionado("a".repeat(80), "MF-0042"), `✓ Solucionado: ${"a".repeat(60)} (MF-0042)`)
assert.equal(clip("áéíóúñ", 3), "áéí")
assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;")
assert.equal(fechaConHora("2026-10-12T10:00:00.000Z").includes("12 de octubre de 2026"), true)
assert.equal(duracion("2026-10-12T10:00:00.000Z", "2026-10-15T10:00:00.000Z"), "3 días")

const fran = {
  codigo: "MF-0042",
  reparacion: "Persiana",
  lugar: "Aula 3",
  nombre: nasty,
  email: "ana@ejemplo.es",
  fecha_apertura: "12 de octubre de 2026, 12:00",
  observaciones: "",
  foto: "",
  url_ticket: "https://ejemplo.pages.dev/gestion/MF-0042",
  pendientes_sin_asignar: "2",
  url_assets: "https://ejemplo.pages.dev/email",
}
const franHtml = render(readFileSync(join(dir, "fran-nuevo.html"), "utf8"), fran, true)
assert.equal(franHtml.includes("Observaciones"), false)
assert.equal(franHtml.includes('src="cid:foto-parte"'), false)
assert.equal(franHtml.includes("&lt;script&gt;"), true)
assert.equal(franHtml.includes("{{"), false)
assert.throws(() => render("Hola {{nombre}} {{falta}}", { nombre: "Ana" }, false), /Falta rellenar \{\{falta\}\}/)

const withPhoto = render(readFileSync(join(dir, "fran-nuevo.html"), "utf8"), { ...fran, observaciones: "Hace ruido", foto: "cid:foto-parte" }, true)
assert.equal(withPhoto.includes('src="cid:foto-parte"'), true)
assert.equal(withPhoto.includes("Hace ruido"), true)

const resuelto = render(
  readFileSync(join(dir, "fran-resuelto.html"), "utf8"),
  {
    tecnico: "Andrés",
    codigo: "MF-0042",
    reparacion: "Persiana",
    lugar: "Aula 3",
    prioridad: "P1",
    fecha_apertura: "12 de octubre de 2026",
    fecha_resuelto: "15 de octubre de 2026",
    duracion: "3 días",
    nombre: "Ana",
    nota_tecnico: "",
    materiales_pendientes: "0",
    url_ticket: "https://ejemplo.pages.dev/gestion/MF-0042",
    url_assets: "https://ejemplo.pages.dev/email",
  },
  true,
)
assert.equal(resuelto.includes("material(es)"), false)
assert.equal(resuelto.includes("Nota de"), false)

for (const name of ["recibido.html", "recibido.txt", "fran-nuevo.html", "fran-nuevo.txt", "fran-resuelto.html", "fran-resuelto.txt", "cerrado.html", "cerrado.txt"]) {
  assert.equal(readFileSync(join(dir, name), "utf8"), readFileSync(join(assets, name), "utf8"), name)
}

console.log("plantillas OK")
