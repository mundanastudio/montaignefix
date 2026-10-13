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
  firstName,
  subjectRecibido,
  subjectRechazado,
  subjectDuplicado,
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
assert.equal(subjectRechazado("MF-0042", "a".repeat(80)), `Sobre tu solicitud MF-0042: ${"a".repeat(60)}`)
assert.equal(subjectRechazado("MF-0042", "Persiana").toLowerCase().includes("rechaz"), false)
assert.equal(subjectDuplicado("MF-0042"), "Tu aviso MF-0042 ya estaba registrado")
assert.equal(firstName("María José Pérez"), "María")

const motivo = "Línea 1\nLínea 2 <b>no</b> & más"
const rechazado = render(
  readFileSync(join(dir, "rechazado.html"), "utf8"),
  {
    nombre: "Ana",
    codigo: "MF-0042",
    reparacion: "Persiana",
    lugar: "Aula 3",
    fecha_apertura: "12 de octubre de 2026",
    motivo,
    url_formulario: "https://ejemplo.pages.dev/",
    url_assets: "https://ejemplo.pages.dev/email",
  },
  true,
)
assert.equal(rechazado.includes("<b>no</b>"), false)
assert.equal(rechazado.includes("&lt;b&gt;no&lt;/b&gt;"), true)
assert.equal(rechazado.includes("&amp;"), true)
assert.equal(rechazado.includes("Línea 1<br>Línea 2"), true)
const rechazadoTxt = render(readFileSync(join(dir, "rechazado.txt"), "utf8"), {
  nombre: "Ana",
  codigo: "MF-0042",
  reparacion: "Persiana",
  lugar: "Aula 3",
  fecha_apertura: "12 de octubre de 2026",
  motivo,
  url_formulario: "https://ejemplo.pages.dev/",
  url_assets: "https://ejemplo.pages.dev/email",
}, false)
assert.equal(rechazadoTxt.includes("Línea 1\nLínea 2 <b>no</b> & más"), true)
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
  foto1: "",
  foto2: "",
  foto3: "",
  foto_titulo: "Foto del desperfecto",
  foto_pie: "También va adjunta a este correo.",
  foto_txt: "Foto: adjunta a este correo.",
  url_ticket: "https://ejemplo.pages.dev/gestion/MF-0042",
  pendientes_sin_asignar: "2",
  url_assets: "https://ejemplo.pages.dev/email",
}
const franHtml = render(readFileSync(join(dir, "fran-nuevo.html"), "utf8"), fran, true)
assert.equal(franHtml.includes("Observaciones"), false)
assert.equal(franHtml.includes('src="cid:foto-parte"'), false)
assert.equal(franHtml.includes('src="cid:foto-1"'), false)
assert.equal(franHtml.includes("&lt;script&gt;"), true)
assert.equal(franHtml.includes("{{"), false)
assert.throws(() => render("Hola {{nombre}} {{falta}}", { nombre: "Ana" }, false), /Falta rellenar \{\{falta\}\}/)

const withPhoto = render(
  readFileSync(join(dir, "fran-nuevo.html"), "utf8"),
  {
    ...fran,
    observaciones: "Hace ruido",
    foto: "1",
    foto1: "cid:foto-1",
  },
  true,
)
assert.equal(withPhoto.includes('src="cid:foto-1"'), true)
assert.equal(withPhoto.includes('src="cid:foto-2"'), false)
assert.equal(withPhoto.includes("cid:foto-parte"), false)
assert.equal(withPhoto.includes("Foto del desperfecto"), true)
assert.equal(withPhoto.includes("Fotos del desperfecto"), false)
assert.equal(withPhoto.includes("También va adjunta"), true)
assert.equal(withPhoto.includes("Hace ruido"), true)

const withThree = render(
  readFileSync(join(dir, "fran-nuevo.html"), "utf8"),
  {
    ...fran,
    foto: "3",
    foto1: "cid:foto-1",
    foto2: "cid:foto-2",
    foto3: "cid:foto-3",
    foto_titulo: "Fotos del desperfecto",
    foto_pie: "También van adjuntas a este correo.",
    foto_txt: "Fotos: adjuntas a este correo.",
  },
  true,
)
assert.equal(withThree.includes('src="cid:foto-1"'), true)
assert.equal(withThree.includes('src="cid:foto-2"'), true)
assert.equal(withThree.includes('src="cid:foto-3"'), true)
assert.equal(withThree.includes("Fotos del desperfecto"), true)
assert.equal(withThree.includes("También van adjuntas"), true)
const withThreeTxt = render(readFileSync(join(dir, "fran-nuevo.txt"), "utf8"), {
  ...fran,
  foto: "3",
  foto_txt: "Fotos: adjuntas a este correo.",
}, false)
assert.equal(withThreeTxt.includes("Fotos: adjuntas a este correo."), true)

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

const duplicadoVars = {
  nombre: firstName("María José Pérez"),
  codigo: "MF-0042",
  codigo_original: "MF-0007",
  reparacion: "Persiana",
  lugar: "Aula 3",
  fecha_apertura: "12 de octubre de 2026",
  url_formulario: "https://ejemplo.pages.dev/",
  url_assets: "https://ejemplo.pages.dev/email",
}
const duplicadoHtml = render(readFileSync(join(dir, "duplicado.html"), "utf8"), duplicadoVars, true)
assert.equal(duplicadoHtml.includes("Hola María,"), true)
assert.equal(duplicadoHtml.includes("José"), false)
assert.equal(duplicadoHtml.includes("MF-0042"), true)
assert.equal(duplicadoHtml.includes("MF-0007"), true)
assert.equal(duplicadoHtml.includes("{{"), false)
const duplicadoTxt = render(readFileSync(join(dir, "duplicado.txt"), "utf8"), duplicadoVars, false)
assert.equal(duplicadoTxt.includes("Hola María,"), true)
assert.equal(duplicadoTxt.includes("MF-0007"), true)
assert.equal(duplicadoTxt.includes("MF-0042"), true)

for (const name of ["recibido.html", "recibido.txt", "fran-nuevo.html", "fran-nuevo.txt", "fran-resuelto.html", "fran-resuelto.txt", "cerrado.html", "cerrado.txt", "rechazado.html", "rechazado.txt", "duplicado.html", "duplicado.txt"]) {
  assert.equal(readFileSync(join(dir, name), "utf8"), readFileSync(join(assets, name), "utf8"), name)
}

console.log("plantillas OK")
