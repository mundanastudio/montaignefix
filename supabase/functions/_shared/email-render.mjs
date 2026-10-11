/** Sustitución de plantillas de correo. Sin secretos y sin red. */

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function clip(value, max) {
  const chars = Array.from(String(value).replace(/\s+/g, " ").trim())
  return chars.slice(0, max).join("")
}

export function fechaLarga(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function fechaConHora(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const day = fechaLarga(iso)
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
  return `${day}, ${time}`
}

export function duracion(fromIso, toIso) {
  const day = (iso) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso))
  const days = Math.round((Date.parse(day(toIso)) - Date.parse(day(fromIso))) / 86_400_000)
  if (!Number.isFinite(days) || days <= 0) return "el mismo día"
  if (days === 1) return "1 día"
  return `${days} días`
}

export function subjectRecibido(codigo) {
  return `Hemos recibido tu solicitud ${codigo}`
}

export function subjectFranNuevo(codigo, reparacion, lugar) {
  return `Nuevo parte ${codigo}: ${clip(reparacion, 60)} · ${lugar}`
}

export function subjectFranResuelto(tecnico, codigo, reparacion) {
  return `${tecnico} ha resuelto ${codigo}: ${clip(reparacion, 60)}`
}

export function subjectSolucionado(reparacion, codigo) {
  return `✓ Solucionado: ${clip(reparacion, 60)} (${codigo})`
}

export function publicUrls(base) {
  const root = String(base ?? "").trim().replace(/\/+$/, "")
  if (!root) return null
  return { formulario: `${root}/`, assets: `${root}/email` }
}

const USER_FIELDS = new Set(["nombre", "reparacion", "lugar", "observaciones", "nota_tecnico", "email", "tecnico"])

function empty(value) {
  if (value === undefined || value === null) return true
  const text = String(value).trim()
  return text === "" || text === "0"
}

/** Quita el bloque entero si la variable está vacía o es 0. */
export function stripOptional(template, vars) {
  return template.replace(/<!--IF:(\w+)-->([\s\S]*?)<!--ENDIF:\1-->/g, (_, key, block) => (empty(vars[key]) ? "" : block))
}

/** Una sola pasada: lo que escribe el usuario no puede reinyectar otra variable. */
export function fill(template, vars, html) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key] ?? ""
    return html && USER_FIELDS.has(key) ? escapeHtml(value) : String(value)
  })
}

export function render(template, vars, html) {
  const stripped = stripOptional(template, vars)
  const pending = [...stripped.matchAll(/\{\{(\w+)\}\}/g)].find((match) => !(match[1] in vars))
  if (pending) throw new Error(`Falta rellenar ${pending[0]} en la plantilla.`)
  return fill(stripped, vars, html)
}

export function plain(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}
