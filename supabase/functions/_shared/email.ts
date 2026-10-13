// Envío SMTP por el puerto 465. Un fallo aquí no deshace el parte: se apunta en email_log.
import {
  cerradoHtml,
  cerradoTxt,
  duplicadoHtml,
  duplicadoTxt,
  franNuevoHtml,
  franNuevoTxt,
  franResueltoHtml,
  franResueltoTxt,
  recibidoHtml,
  recibidoTxt,
  rechazadoHtml,
  rechazadoTxt,
} from "./email-bodies.ts"
import {
  duracion,
  fechaConHora,
  fechaLarga,
  firstName,
  plain,
  publicUrls,
  render,
  subjectFranNuevo,
  subjectFranResuelto,
  subjectDuplicado,
  subjectRecibido,
  subjectRechazado,
  subjectSolucionado,
} from "./email-render.mjs"
import { uniqueClosedRecipients } from "./duplicateMail.ts"
import { db } from "./http.ts"

type Kind = "nuevo" | "recibido" | "resuelto" | "cerrado" | "rechazado" | "duplicado" | "prueba" | "informe" | "aviso"

interface Outgoing {
  kind: Kind
  ticketId?: string | null
  to: string
  subject: string
  html: string
  text: string
  photos?: Array<{ bytes: Uint8Array; name: string; cid: string }>
  pdf?: Uint8Array | null
  pdfName?: string
}

function urls() {
  return publicUrls(Deno.env.get("APP_PUBLIC_URL"))
}

function secretText(value: string | undefined): string {
  let text = (value ?? "").replace(/^\uFEFF/, "").replace(/\r/g, "").trim()
  if (text.length >= 2) {
    const quote = text[0]
    if ((quote === '"' || quote === "'") && text.endsWith(quote)) text = text.slice(1, -1).trim()
  }
  return text.replace(/[\r\n]/g, "")
}

function publicError(error: unknown): string {
  const password = secretText(Deno.env.get("SMTP_PASSWORD"))
  let message = error instanceof Error ? error.message : "No se ha podido enviar el correo."
  if (password) {
    message = message.split(password).join("••••")
    message = message.split(bytesToBase64(new TextEncoder().encode(password))).join("••••")
  }
  if (/Falta la configuración SMTP/.test(message)) {
    return "Falta la configuración del correo (servidor, usuario o contraseña)."
  }
  const smtp = message.match(/^SMTP (\d{3}) ([a-z]+)(?:: (.*))?$/i)
  if (smtp?.[1] === "535" && smtp[2] === "clave") {
    return "El servidor de correo ha rechazado el usuario o la contraseña."
  }
  if (smtp) {
    const detail = (smtp[3] ?? "").replace(/[^\x20-\x7e]/g, " ").trim().slice(0, 120)
    return detail
      ? `El servidor de correo ha respondido ${smtp[1]} al comprobar ${smtp[2]}: ${detail}`
      : `El servidor de correo ha respondido ${smtp[1]} al comprobar ${smtp[2]}.`
  }
  if (/auth|535|credential|password|contraseña/i.test(message)) {
    return "El servidor de correo ha rechazado el usuario o la contraseña."
  }
  if (/timed out|timeout|connect|refused|network/i.test(message)) {
    return "No se ha podido conectar con el servidor de correo."
  }
  return message.slice(0, 300)
}

async function record(row: {
  ticketId?: string | null
  kind: Kind
  recipient: string
  subject: string
  ok: boolean
  error?: string | null
}): Promise<void> {
  const { error } = await db().from("email_log").insert({
    ticket_id: row.ticketId ?? null,
    kind: row.kind,
    recipient: row.recipient,
    subject: row.subject,
    ok: row.ok,
    error: row.error ?? null,
  })
  if (error) console.error("email-log", error.code ?? "insert")
}

async function managerEmail(): Promise<string> {
  const configured = Deno.env.get("MF_MANAGER_EMAIL")?.trim()
  if (configured) return configured
  const { data } = await db().from("staff").select("email").eq("slug", "fran").maybeSingle()
  return typeof data?.email === "string" ? data.email : ""
}

async function deliver(message: Outgoing): Promise<void> {
  const host = Deno.env.get("SMTP_HOST")?.trim() ?? ""
  const user = secretText(Deno.env.get("SMTP_USER"))
  const password = secretText(Deno.env.get("SMTP_PASSWORD"))
  const from = secretText(Deno.env.get("MAIL_FROM"))
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465")
  if (!host || !user || !password || !from || !Number.isInteger(port)) {
    throw new Error("Falta la configuración SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM).")
  }
  const mime = buildMime({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    photos: message.photos,
    pdf: message.pdf,
    pdfName: message.pdfName,
  })
  await smtpSend({ host, port, user, password, from: addressOf(from), to: message.to, mime })
}

function addressOf(from: string): string {
  const match = /<([^>]+)>/.exec(from)
  return (match?.[1] ?? from).trim()
}

function headerValue(value: string): string {
  if (/^[\t\x20-\x7e]*$/.test(value)) return value
  return `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(value))}?=`
}

function wrapBase64(value: string): string {
  return value.replace(/(.{76})/g, "$1\r\n").replace(/\r\n$/, "")
}

function buildMime(input: {
  from: string
  to: string
  subject: string
  text: string
  html: string
  photos?: Array<{ bytes: Uint8Array; name: string; cid: string }>
  pdf?: Uint8Array | null
  pdfName?: string
}): string {
  const alt = `mf-alt-${crypto.randomUUID()}`
  const text64 = wrapBase64(bytesToBase64(new TextEncoder().encode(input.text)))
  const html64 = wrapBase64(bytesToBase64(new TextEncoder().encode(input.html)))
  const alternative = [
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    text64,
    "",
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    html64,
    "",
    `--${alt}--`,
  ]
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${headerValue(input.subject)}`,
    "MIME-Version: 1.0",
  ]
  const pdfName = input.pdfName ?? "informe.pdf"
  const pdfPart = (boundary: string) =>
    input.pdf
      ? [
          `--${boundary}`,
          `Content-Type: application/pdf; name="${pdfName}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${pdfName}"`,
          "",
          wrapBase64(bytesToBase64(input.pdf)),
          "",
        ]
      : []
  const photos = input.photos ?? []
  if (photos.length === 0 && !input.pdf) {
    return [...headers, `Content-Type: multipart/alternative; boundary="${alt}"`, "", ...alternative, ""].join("\r\n")
  }
  if (photos.length === 0) {
    const mix = `mf-mix-${crypto.randomUUID()}`
    return [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mix}"`,
      "",
      `--${mix}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      ...alternative,
      "",
      ...pdfPart(mix),
      `--${mix}--`,
      "",
    ].join("\r\n")
  }
  const mix = `mf-mix-${crypto.randomUUID()}`
  const rel = `mf-rel-${crypto.randomUUID()}`
  const inline = photos.flatMap((photo) => {
    const photo64 = wrapBase64(bytesToBase64(photo.bytes))
    return [
      `--${rel}`,
      `Content-Type: image/jpeg; name="${photo.name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${photo.cid}>`,
      `Content-Disposition: inline; filename="${photo.name}"`,
      "",
      photo64,
      "",
    ]
  })
  const attached = photos.flatMap((photo) => {
    const photo64 = wrapBase64(bytesToBase64(photo.bytes))
    return [
      `--${mix}`,
      `Content-Type: image/jpeg; name="${photo.name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${photo.name}"`,
      "",
      photo64,
      "",
    ]
  })
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mix}"`,
    "",
    `--${mix}`,
    `Content-Type: multipart/related; boundary="${rel}"`,
    "",
    `--${rel}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    ...alternative,
    "",
    ...inline,
    `--${rel}--`,
    ...pdfPart(mix),
    ...attached,
    `--${mix}--`,
    "",
  ].join("\r\n")
}

/** mail.mundana.us presenta el certificado *.correoseguro.dinaserver.com. Se comprueba ese nombre, sin saltarse TLS. */
async function openSmtp(host: string, port: number): Promise<Deno.TlsConn> {
  if (host !== "mail.mundana.us") return await Deno.connectTls({ hostname: host, port })
  const tcp = await Deno.connect({ hostname: host, port })
  return await Deno.startTls(tcp, { hostname: "correoseguro.dinaserver.com" })
}

async function smtpSend(input: {
  host: string
  port: number
  user: string
  password: string
  from: string
  to: string
  mime: string
}): Promise<void> {
  const conn = await openSmtp(input.host, input.port)
  const reader = conn.readable.getReader()
  const writer = conn.writable.getWriter()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  try {
    const read = async () => {
      let text = ""
      const started = Date.now()
      while (Date.now() - started < 12_000) {
        const { value, done } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        const lines = text.split("\r\n")
        const last = text.endsWith("\r\n") ? lines[lines.length - 2] : ""
        if (/^\d{3} /.test(last)) return text
      }
      throw new Error("timeout")
    }
    const cmd = async (line: string, step: string) => {
      await writer.write(encoder.encode(`${line}\r\n`))
      const reply = await read()
      const code = Number(reply.slice(0, 3))
      if (code >= 400) {
        const detail = (reply.split("\r\n")[0] ?? "").replace(/^\d{3}\s*/, "")
        throw new Error(`SMTP ${code} ${step}: ${detail}`)
      }
      return reply
    }
    const banner = await read()
    if (!banner.startsWith("220")) throw new Error(banner.split("\r\n")[0] ?? "El servidor de correo no ha respondido.")
    await cmd("EHLO montaigne-fix", "saludo")
    await cmd("AUTH LOGIN", "acceso")
    await cmd(bytesToBase64(encoder.encode(input.user)), "usuario")
    await cmd(bytesToBase64(encoder.encode(input.password)), "clave")
    await cmd(`MAIL FROM:<${input.from}>`, "remitente")
    await cmd(`RCPT TO:<${input.to}>`, "destinatario")
    await cmd("DATA", "mensaje")
    const stuffed = input.mime.replace(/^\./gm, "..")
    await writer.write(encoder.encode(`${stuffed}\r\n.\r\n`))
    const accepted = await read()
    if (!accepted.startsWith("250")) throw new Error(accepted.split("\r\n")[0] ?? "El servidor no ha aceptado el mensaje.")
    await cmd("QUIT")
  } finally {
    try {
      reader.releaseLock()
      writer.releaseLock()
      conn.close()
    } catch {
      // La conexión ya se cerró.
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const size = 0x8000
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size))
  }
  return btoa(binary)
}

async function send(message: Outgoing): Promise<{ ok: boolean; error: string | null }> {
  if (!message.to) {
    const error = "No hay destinatario para este correo."
    await record({ ...message, recipient: "", ok: false, error })
    return { ok: false, error }
  }
  try {
    await deliver(message)
    await record({ ...message, recipient: message.to, ok: true })
    return { ok: true, error: null }
  } catch (error) {
    const text = publicError(error)
    console.error("email", message.kind)
    await record({ ...message, recipient: message.to, ok: false, error: text })
    return { ok: false, error: text }
  }
}

interface TicketMail {
  id: string
  code: string
  requester_name: string
  requester_email: string
  description: string
  location: string
  requester_notes: string | null
  created_at: string
  resolved_at: string | null
  closed_at: string | null
  priority: string | null
  duplicate_of: string | null
}

async function loadTicket(id: string): Promise<TicketMail | null> {
  const { data, error } = await db()
    .from("tickets")
    .select("id, code, requester_name, requester_email, description, location, requester_notes, created_at, resolved_at, closed_at, priority, duplicate_of")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return data as TicketMail
}

async function rendered(input: {
  kind: Kind
  ticketId?: string | null
  to: string
  subject: string
  htmlTemplate: string
  textTemplate: string
  vars: Record<string, string>
  photos?: Array<{ bytes: Uint8Array; name: string; cid: string }>
}): Promise<{ ok: boolean; error: string | null }> {
  let html = ""
  let text = ""
  try {
    html = render(input.htmlTemplate, input.vars, true)
    text = render(input.textTemplate, input.vars, false)
  } catch (error) {
    const message = publicError(error)
    await record({ ticketId: input.ticketId, kind: input.kind, recipient: input.to, subject: input.subject, ok: false, error: message })
    return { ok: false, error: message }
  }
  const message = {
    kind: input.kind,
    ticketId: input.ticketId,
    subject: input.subject,
    html,
    text,
    photos: input.photos,
  }
  const primary = await send({ ...message, to: input.to })
  return primary
}

function ticketUrl(links: { formulario: string }, code: string): string {
  return `${links.formulario}gestion/${encodeURIComponent(code)}`
}

export async function notifyNew(input: {
  ticketId: string
  code: string
  name: string
  email: string
  description: string
  location: string
  notes: string
  createdAt: string
  photos: Uint8Array[]
}): Promise<void> {
  const links = urls()
  const fran = await managerEmail()
  const reparacion = plain(input.description)
  const lugar = plain(input.location)
  const nombre = plain(input.name)
  const observaciones = plain(input.notes)
  const subjectFran = subjectFranNuevo(input.code, reparacion, lugar)
  const subjectUser = subjectRecibido(input.code)
  if (!links) {
    await record({ ticketId: input.ticketId, kind: "recibido", recipient: input.email, subject: subjectUser, ok: false, error: "Falta APP_PUBLIC_URL." })
    await record({ ticketId: input.ticketId, kind: "nuevo", recipient: fran, subject: subjectFran, ok: false, error: "Falta APP_PUBLIC_URL." })
    return
  }
  const { count } = await db().from("tickets").select("id", { count: "exact", head: true }).eq("status", "nuevo")
  const comunes = { url_assets: links.assets }
  const n = input.photos.length
  const several = n > 1
  await rendered({
    kind: "recibido",
    ticketId: input.ticketId,
    to: input.email,
    subject: subjectUser,
    htmlTemplate: recibidoHtml,
    textTemplate: recibidoTxt,
    vars: {
      ...comunes,
      nombre,
      codigo: input.code,
      reparacion,
      lugar,
      fecha_apertura: fechaLarga(input.createdAt),
      observaciones,
    },
  })
  await rendered({
    kind: "nuevo",
    ticketId: input.ticketId,
    to: fran,
    subject: subjectFran,
    htmlTemplate: franNuevoHtml,
    textTemplate: franNuevoTxt,
    vars: {
      ...comunes,
      codigo: input.code,
      reparacion,
      lugar,
      nombre,
      email: plain(input.email),
      fecha_apertura: fechaConHora(input.createdAt),
      observaciones,
      foto: n > 0 ? String(n) : "",
      foto1: n >= 1 ? "cid:foto-1" : "",
      foto2: n >= 2 ? "cid:foto-2" : "",
      foto3: n >= 3 ? "cid:foto-3" : "",
      foto_titulo: several ? "Fotos del desperfecto" : "Foto del desperfecto",
      foto_pie: several ? "También van adjuntas a este correo." : "También va adjunta a este correo.",
      foto_txt: several ? "Fotos: adjuntas a este correo." : "Foto: adjunta a este correo.",
      url_ticket: ticketUrl(links, input.code),
      pendientes_sin_asignar: String(count ?? 1),
    },
    photos: input.photos.map((bytes, index) => ({
      bytes,
      name: `foto-${index + 1}-${input.code}.jpg`,
      cid: `foto-${index + 1}`,
    })),
  })
}

export async function notifyResolved(ticketId: string, technicianId: string, technicianName: string): Promise<void> {
  const ticket = await loadTicket(ticketId)
  const to = await managerEmail()
  if (!ticket) {
    await record({ ticketId, kind: "resuelto", recipient: to, subject: "Parte resuelto", ok: false, error: "No se ha podido leer el parte para avisar." })
    return
  }
  const links = urls()
  const tecnico = plain(technicianName) || "El equipo"
  const reparacion = plain(ticket.description)
  const subject = subjectFranResuelto(tecnico, ticket.code, reparacion)
  if (!links) {
    await record({ ticketId, kind: "resuelto", recipient: to, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return
  }
  const resolvedAt = ticket.resolved_at ?? new Date().toISOString()
  const { data: note } = await db()
    .from("ticket_notes")
    .select("body")
    .eq("ticket_id", ticketId)
    .eq("kind", "interna")
    .eq("author_id", technicianId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const { count } = await db()
    .from("shopping_items")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId)
    .eq("status", "pendiente")
  const pending = count ?? 0
  const prioridad = ticket.priority === "p1" || ticket.priority === "p2" || ticket.priority === "p3"
    ? ticket.priority.toUpperCase()
    : "Sin prioridad"
  await rendered({
    kind: "resuelto",
    ticketId,
    to,
    subject,
    htmlTemplate: franResueltoHtml,
    textTemplate: franResueltoTxt,
    vars: {
      url_assets: links.assets,
      tecnico,
      codigo: ticket.code,
      reparacion,
      lugar: plain(ticket.location),
      prioridad,
      fecha_apertura: fechaLarga(ticket.created_at),
      fecha_resuelto: fechaLarga(resolvedAt),
      duracion: duracion(ticket.created_at, resolvedAt),
      nombre: plain(ticket.requester_name),
      nota_tecnico: plain(typeof note?.body === "string" ? note.body : ""),
      materiales_pendientes: pending > 0 ? String(pending) : "",
      url_ticket: ticketUrl(links, ticket.code),
    },
  })
}

export async function notifyRejected(ticketId: string, reason: string): Promise<{ ok: boolean; error: string | null }> {
  const ticket = await loadTicket(ticketId)
  const motivo = reason.trim()
  if (!ticket) {
    await record({ ticketId, kind: "rechazado", recipient: "", subject: "Sobre tu solicitud", ok: false, error: "No se ha podido leer el parte para avisar al solicitante." })
    return { ok: false, error: "No se ha podido leer el parte para avisar al solicitante." }
  }
  const links = urls()
  const subject = subjectRechazado(ticket.code, ticket.description)
  if (!links) {
    await record({ ticketId, kind: "rechazado", recipient: ticket.requester_email, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "rechazado",
    ticketId,
    to: ticket.requester_email,
    subject,
    htmlTemplate: rechazadoHtml,
    textTemplate: rechazadoTxt,
    vars: {
      nombre: firstName(ticket.requester_name),
      codigo: ticket.code,
      reparacion: plain(ticket.description),
      lugar: plain(ticket.location),
      fecha_apertura: fechaLarga(ticket.created_at),
      motivo,
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

async function sendClosedMail(ticket: TicketMail): Promise<{ ok: boolean; error: string | null }> {
  const links = urls()
  const subject = subjectSolucionado(ticket.description, ticket.code)
  if (!links) {
    await record({ ticketId: ticket.id, kind: "cerrado", recipient: ticket.requester_email, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "cerrado",
    ticketId: ticket.id,
    to: ticket.requester_email,
    subject,
    htmlTemplate: cerradoHtml,
    textTemplate: cerradoTxt,
    vars: {
      nombre: plain(ticket.requester_name),
      codigo: ticket.code,
      reparacion: plain(ticket.description),
      lugar: plain(ticket.location),
      fecha_apertura: fechaLarga(ticket.created_at),
      fecha_cierre: fechaLarga(ticket.closed_at ?? new Date().toISOString()),
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

export async function notifyClosed(ticketId: string): Promise<{ ok: boolean; error: string | null }> {
  const ticket = await loadTicket(ticketId)
  if (!ticket) {
    await record({ ticketId, kind: "cerrado", recipient: "", subject: "Parte cerrado", ok: false, error: "No se ha podido leer el parte para avisar al solicitante." })
    return { ok: false, error: "No se ha podido leer el parte para avisar al solicitante." }
  }
  const primary = await sendClosedMail(ticket)
  const { data } = await db()
    .from("tickets")
    .select("id, code, requester_name, requester_email, description, location, created_at, closed_at")
    .eq("duplicate_of", ticketId)
    .order("code", { ascending: true })
  const extras = uniqueClosedRecipients(ticket.requester_email, (data ?? []) as Array<TicketMail & { requester_email: string }>)
  let error = primary.error
  for (const row of extras) {
    const mail = await sendClosedMail({
      ...ticket,
      id: String(row.id),
      code: String(row.code),
      requester_name: String(row.requester_name),
      requester_email: String(row.requester_email),
      description: String(row.description),
      location: String(row.location),
      created_at: String(row.created_at),
      closed_at: ticket.closed_at,
    })
    if (!mail.ok) error = error ?? mail.error
  }
  return { ok: error === null, error }
}

export async function notifyDuplicated(ticketId: string): Promise<{ ok: boolean; error: string | null }> {
  const ticket = await loadTicket(ticketId)
  if (!ticket) {
    await record({ ticketId, kind: "duplicado", recipient: "", subject: "Tu aviso ya estaba registrado", ok: false, error: "No se ha podido leer el parte para avisar al solicitante." })
    return { ok: false, error: "No se ha podido leer el parte para avisar al solicitante." }
  }
  const original = ticket.duplicate_of ? await loadTicket(ticket.duplicate_of) : null
  const subject = subjectDuplicado(ticket.code)
  if (!original) {
    await record({ ticketId, kind: "duplicado", recipient: ticket.requester_email, subject, ok: false, error: "No se ha podido leer el parte original." })
    return { ok: false, error: "No se ha podido leer el parte original." }
  }
  const links = urls()
  if (!links) {
    await record({ ticketId, kind: "duplicado", recipient: ticket.requester_email, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "duplicado",
    ticketId,
    to: ticket.requester_email,
    subject,
    htmlTemplate: duplicadoHtml,
    textTemplate: duplicadoTxt,
    vars: {
      nombre: firstName(ticket.requester_name),
      codigo: ticket.code,
      codigo_original: original.code,
      reparacion: plain(ticket.description),
      lugar: plain(ticket.location),
      fecha_apertura: fechaLarga(ticket.created_at),
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

export async function sendDuplicadoSample(to: string, name: string): Promise<{ ok: boolean; error: string | null }> {
  const links = urls()
  const opened = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const subject = subjectDuplicado("MF-PRUEBA")
  if (!links) {
    await record({ kind: "prueba", recipient: to, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "prueba",
    to,
    subject,
    htmlTemplate: duplicadoHtml,
    textTemplate: duplicadoTxt,
    vars: {
      nombre: firstName(name) || "Fran",
      codigo: "MF-PRUEBA",
      codigo_original: "MF-0007",
      reparacion: "Prueba de correo: la persiana del aula no sube",
      lugar: "Aula 3",
      fecha_apertura: fechaLarga(opened),
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

export async function sendRejectedSample(to: string, name: string): Promise<{ ok: boolean; error: string | null }> {
  const links = urls()
  const opened = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const reparacion = "Prueba de correo: la persiana del aula no sube"
  const subject = subjectRechazado("MF-PRUEBA", reparacion)
  const motivo =
    "Lo hemos revisado y ya está solucionado o funciona correctamente.\n\nSi ves que no es así, abre un nuevo parte."
  if (!links) {
    await record({ kind: "prueba", recipient: to, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "prueba",
    to,
    subject,
    htmlTemplate: rechazadoHtml,
    textTemplate: rechazadoTxt,
    vars: {
      nombre: firstName(name) || "Fran",
      codigo: "MF-PRUEBA",
      reparacion,
      lugar: "Aula 3",
      fecha_apertura: fechaLarga(opened),
      motivo,
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

export async function sendClosedSample(to: string, name: string): Promise<{ ok: boolean; error: string | null }> {
  const links = urls()
  const opened = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const closed = new Date().toISOString()
  const reparacion = "Prueba de correo: la puerta del patio no cierra"
  const subject = subjectSolucionado(reparacion, "MF-PRUEBA")
  if (!links) {
    await record({ kind: "prueba", recipient: to, subject, ok: false, error: "Falta APP_PUBLIC_URL." })
    return { ok: false, error: "Falta APP_PUBLIC_URL." }
  }
  return rendered({
    kind: "prueba",
    to,
    subject,
    htmlTemplate: cerradoHtml,
    textTemplate: cerradoTxt,
    vars: {
      nombre: plain(name) || "Fran",
      codigo: "MF-PRUEBA",
      reparacion,
      lugar: "Patio",
      fecha_apertura: fechaLarga(opened),
      fecha_cierre: fechaLarga(closed),
      url_formulario: links.formulario,
      url_assets: links.assets,
    },
  })
}

export async function sendReport(input: {
  to: string
  subject: string
  html: string
  text: string
  pdf: Uint8Array
  pdfName: string
}): Promise<{ ok: boolean; error: string | null }> {
  const message = {
    kind: "informe" as const,
    subject: input.subject,
    html: input.html,
    text: input.text,
    pdf: input.pdf,
    pdfName: input.pdfName,
  }
  const primary = await send({ ...message, to: input.to })
  return primary
}

export async function sendNotice(to: string, subject: string, text: string): Promise<void> {
  const html = `<p style="font-family:Georgia,serif;font-size:16px;color:#1a1a1a;">${text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")}</p>`
  await send({ kind: "aviso", to, subject, html, text })
}

export async function listEmails(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await db()
    .from("email_log")
    .select("id, ticket_id, kind, recipient, subject, ok, error, created_at")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    ticketId: row.ticket_id,
    kind: row.kind,
    recipient: row.recipient,
    subject: row.subject,
    ok: row.ok,
    error: row.error,
    createdAt: row.created_at,
  }))
}
