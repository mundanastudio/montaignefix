import { sendNotice, sendReport } from "./email.ts"
import { escapeHtml, fechaLarga } from "./email-render.mjs"
import { db } from "./http.ts"
import { listTicketPhotoPaths, removeStorage } from "./photos.ts"
import { buildReportPdf, type PdfTicket } from "./report-pdf.ts"

const OPEN = ["nuevo", "asignado", "en_curso", "en_espera"]
const STATUS: Record<string, string> = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  en_curso: "En curso",
  en_espera: "En espera",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
  duplicado: "Duplicado",
}

interface Row {
  id: string
  code: string
  requester_name: string
  requester_email: string
  description: string
  location: string
  requester_notes: string | null
  status: string
  priority: string | null
  assigned_to: string | null
  photo_path: string | null
  created_at: string
  assigned_at: string | null
  resolved_at: string | null
  closed_at: string | null
}

function madridParts(iso: string, withTime: boolean) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(date)
}

function pickPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? ""
}

function when(iso: string | null | undefined): string {
  if (!iso) return "—"
  const parts = madridParts(iso, true)
  if (!parts) return "—"
  return `${pickPart(parts, "day")}/${pickPart(parts, "month")}/${pickPart(parts, "year")} · ${pickPart(parts, "hour")}:${pickPart(parts, "minute")}`
}

function whenDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const parts = madridParts(iso, false)
  if (!parts) return "—"
  return `${pickPart(parts, "day")}/${pickPart(parts, "month")}/${pickPart(parts, "year")}`
}

function duration(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "—"
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "0d0h"
  const hours = Math.floor((end - start) / 3_600_000)
  return `${Math.floor(hours / 24)}d${hours % 24}h`
}

function doneDates(row: Row): string {
  const resolved = row.resolved_at ?? row.closed_at
  return `Abierta: ${whenDate(row.created_at)}\nResuelta: ${whenDate(resolved)}\nTiempo: ${duration(row.created_at, resolved)}`
}

function openDates(row: Row): string {
  return `Abierta: ${when(row.created_at)}`
}

function asideDates(row: Row): string {
  return `Abierta: ${whenDate(row.created_at)}\nCerrada: ${whenDate(row.closed_at)}`
}

function ticketHref(code: string): string {
  const base = (Deno.env.get("APP_PUBLIC_URL") ?? "").replace(/\/$/, "")
  return base ? `${base}/gestion/${encodeURIComponent(code)}` : ""
}

function inWindow(iso: string | null, start: number, end: number): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return time >= start && time < end
}

function priority(value: string | null): string {
  if (value === "p1" || value === "p2" || value === "p3") return value.toUpperCase()
  return "Sin prioridad"
}

function status(value: string): string {
  return STATUS[value] ?? value
}

function clip(value: string, max = 80): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`
}

export function madridNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: Number(pick("hour")),
    weekday: pick("weekday"),
    key: `${pick("year")}-${pick("month")}-${pick("day")}`,
  }
}

async function names(): Promise<Map<string, string>> {
  const { data } = await db().from("staff").select("id, name")
  return new Map((data ?? []).map((row) => [String(row.id), String(row.name)]))
}

async function managerEmail(): Promise<string> {
  const configured = Deno.env.get("MF_MANAGER_EMAIL")?.trim()
  if (configured) return configured
  const { data } = await db().from("staff").select("email").eq("slug", "fran").maybeSingle()
  return typeof data?.email === "string" ? data.email : ""
}

async function reportRecipients(): Promise<string[]> {
  const set = new Set<string>()
  const fran = await managerEmail()
  if (fran) set.add(fran)
  const { data } = await db().from("staff").select("email").eq("slug", "curro").eq("active", true).maybeSingle()
  const curro = typeof data?.email === "string" ? data.email.trim() : ""
  set.add(curro || "curromena89@gmail.com")
  return [...set]
}

async function sendToManagers(pack: {
  subject: string
  html: string
  text: string
  pdf: Uint8Array
  pdfName: string
}): Promise<{ ok: boolean; error: string | null }> {
  const recipients = await reportRecipients()
  if (!recipients.length) return { ok: false, error: "No hay destinatarios para el informe." }
  const errors: string[] = []
  for (const to of recipients) {
    const sent = await sendReport({ to, ...pack })
    if (!sent.ok) errors.push(`${to}: ${sent.error ?? "fallo"}`)
  }
  return { ok: errors.length === 0, error: errors.join(" ") || null }
}

async function fichas(rows: Row[], staff: Map<string, string>): Promise<PdfTicket[]> {
  return rows.map((row) => {
    const notes = row.requester_notes?.trim()
    const facts: Array<[string, string]> = [
      ["Solicitante", `${row.requester_name} · ${row.requester_email}`],
      ["Asignado", staff.get(row.assigned_to ?? "") ?? "Sin asignar"],
      ["Lugar", row.location],
      ["Reparación", row.description],
    ]
    if (notes) facts.push(["Observaciones", notes])
    facts.push(["Abierta", when(row.created_at)])
    facts.push(["Resuelta", row.resolved_at || row.closed_at ? when(row.resolved_at ?? row.closed_at) : "—"])
    return {
      code: row.code,
      title: clip(row.description, 90),
      href: ticketHref(row.code),
      facts,
    }
  })
}

async function shoppingTable(
  staff: Map<string, string>,
  kind: "pendiente" | "comprado",
  start?: Date,
  end?: Date,
) {
  const { data } = await db()
    .from("shopping_items")
    .select("description, created_at, purchased_at, requested_by, ticket_id")
    .eq("status", kind)
    .order(kind === "comprado" ? "purchased_at" : "created_at", { ascending: true })
  let items = data ?? []
  if (kind === "comprado" && start && end) {
    const startMs = start.getTime()
    const endMs = end.getTime()
    items = items.filter((item) => inWindow(item.purchased_at ? String(item.purchased_at) : null, startMs, endMs))
  }
  const ids = [...new Set(items.map((item) => String(item.ticket_id)))]
  const { data: tickets } = ids.length
    ? await db().from("tickets").select("id, code, location").in("id", ids)
    : { data: [] }
  const places = new Map((tickets ?? []).map((ticket) => [String(ticket.id), ticket]))
  return items.map((item) => {
    const ticket = places.get(String(item.ticket_id))
    const times =
      kind === "comprado"
        ? `Solicitado: ${whenDate(String(item.created_at))}\nComprado: ${whenDate(item.purchased_at ? String(item.purchased_at) : null)}`
        : when(String(item.created_at))
    return [
      String(item.description),
      `${ticket?.code ?? "—"} · ${ticket?.location ?? ""}`,
      staff.get(String(item.requested_by)) ?? "",
      times,
    ]
  })
}

function rowCells(row: Row, staff: Map<string, string>, dates: string): string[] {
  return [
    row.code,
    clip(row.description),
    row.location,
    priority(row.priority),
    status(row.status),
    staff.get(row.assigned_to ?? "") ?? "Sin asignar",
    dates,
  ]
}

function htmlTable(headers: string[], rows: string[][]): string {
  const head = headers.map((cell) => `<th style="text-align:left;padding:8px;border-bottom:2px solid #f0a21d;color:#0c216e;">${escapeHtml(cell)}</th>`).join("")
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td style="padding:8px;border-bottom:1px solid #e2e2e2;vertical-align:top;">${escapeHtml(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${headers.length}" style="padding:8px;color:#595959;">Ninguna</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#333;">${`<tr>${head}</tr>`}${body}</table>`
}

function emailHtml(title: string, intro: string, blocks: Array<{ title: string; headers: string[]; rows: string[][] }>): string {
  const sections = blocks
    .map(
      (block) =>
        `<h2 style="margin:24px 0 8px;font-size:16px;color:#0c216e;">${escapeHtml(block.title)}</h2>${htmlTable(block.headers, block.rows)}`,
    )
    .join("")
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f3f5fa;color:#333;">
  <div style="height:8px;background:#0c216e;"></div><div style="height:4px;background:#f0a21d;"></div>
  <div style="max-width:720px;margin:0 auto;padding:24px 16px 40px;font-family:Helvetica,Arial,sans-serif;">
    <h1 style="margin:0 0 8px;color:#0c216e;font-size:22px;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 8px;color:#595959;">${escapeHtml(intro)}</p>
    <p style="margin:0;color:#595959;">El detalle de cada incidencia va en el PDF adjunto.</p>
    ${sections}
    <p style="margin-top:28px;color:#595959;font-size:12px;">Montaigne Fix · Colegio Montaigne de Sevilla · powered by Mundana Studio</p>
  </div></body></html>`
}

function emailText(title: string, intro: string, blocks: Array<{ title: string; headers: string[]; rows: string[][] }>): string {
  const sections = blocks
    .map((block) => {
      const lines = block.rows.length ? block.rows.map((row) => row.join(" | ")).join("\n") : "Ninguna"
      return `${block.title}\n${lines}`
    })
    .join("\n\n")
  return `${title}\n${intro}\nEl detalle va en el PDF adjunto.\n\n${sections}\n`
}

async function alreadyOk(kind: string, periodKey: string): Promise<boolean> {
  const { data } = await db().from("report_runs").select("id").eq("kind", kind).eq("period_key", periodKey).eq("ok", true).maybeSingle()
  return Boolean(data)
}

async function markRun(kind: string, periodKey: string, periodEnd: string, ok: boolean, detail: string) {
  await db().from("report_runs").insert({ kind, period_key: periodKey, period_end: periodEnd, ok, detail })
}

export async function sendWeeklyNow(): Promise<{ ok: boolean; error: string | null }> {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  return sendToManagers(await weeklyPackage(start, end))
}

async function weeklyPackage(start: Date, end: Date) {
  const staff = await names()
  const { data } = await db()
    .from("tickets")
    .select("id, code, requester_name, requester_email, description, location, requester_notes, status, priority, assigned_to, photo_path, created_at, assigned_at, resolved_at, closed_at")
    .order("code", { ascending: true })
  const rows = (data ?? []) as Row[]
  const startMs = start.getTime()
  const endMs = end.getTime()
  const done = rows.filter(
    (row) =>
      (row.status === "cerrado" && inWindow(row.closed_at, startMs, endMs)) ||
      (row.status === "resuelto" && inWindow(row.resolved_at, startMs, endMs)),
  )
  const open = rows.filter((row) => OPEN.includes(row.status))
  const resolvedOpen = rows.filter((row) => row.status === "resuelto")
  const [purchased, shopping] = await Promise.all([
    shoppingTable(staff, "comprado", start, end),
    shoppingTable(staff, "pendiente"),
  ])
  const subtitle = `${fechaLarga(start.toISOString())} al ${fechaLarga(end.toISOString())}`
  const headers = ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Fechas/Tiempo"]
  const ticketWidths = [52, 88, 58, 48, 55, 94, 120]
  const shopBought = ["Artículo", "Incidencia", "Quién lo pidió", "Tiempos"]
  const shopPending = ["Artículo", "Incidencia", "Quién lo pidió", "Solicitado desde"]
  const shopWidths = [145, 140, 100, 130]
  const doneRows = done.map((row) => rowCells(row, staff, doneDates(row)))
  const openRows = open.map((row) => rowCells(row, staff, openDates(row)))
  const blocks = [
    { title: "Resueltas y cerradas esta semana", headers, rows: doneRows },
    { title: "Abiertas", headers, rows: openRows },
    { title: "Materiales comprados", headers: shopBought, rows: purchased },
    { title: "Pendiente de comprar", headers: shopPending, rows: shopping },
  ]
  const pdf = await buildReportPdf({
    title: "Informe semanal",
    subtitle: `Colegio Montaigne de Sevilla · ${subtitle}`,
    counts: [
      ["Cerradas esta semana", String(done.filter((row) => row.status === "cerrado").length)],
      ["Resueltas, sin cerrar", String(resolvedOpen.length)],
      ["Abiertas", String(open.length)],
      ["Material pendiente", String(shopping.length)],
    ],
    tables: [
      { title: "Resueltas y cerradas esta semana", headers, rows: doneRows, widths: ticketWidths },
      { title: "Abiertas", headers, rows: openRows, widths: ticketWidths },
      { title: "Materiales comprados", headers: shopBought, rows: purchased, widths: shopWidths },
      { title: "Pendiente de comprar", headers: shopPending, rows: shopping, widths: shopWidths },
    ],
    tickets: await fichas([...done, ...open], staff),
    closing: "Montaigne Fix · Colegio Montaigne de Sevilla · powered by Mundana Studio",
  })
  const subject = `Informe semanal Montaigne Fix · ${subtitle}`
  return {
    subject,
    html: emailHtml(subject, `Del ${subtitle}.`, blocks),
    text: emailText(subject, `Del ${subtitle}.`, blocks),
    pdf,
    pdfName: `informe-semanal-${madridNow(end).key}.pdf`,
  }
}

async function annualPackage(start: Date, end: Date) {
  const staff = await names()
  const { data } = await db()
    .from("tickets")
    .select("id, code, requester_name, requester_email, description, location, requester_notes, status, priority, assigned_to, photo_path, created_at, assigned_at, resolved_at, closed_at")
    .in("status", ["resuelto", "cerrado", "rechazado", "duplicado"])
  const rows = ((data ?? []) as Row[]).filter((row) => {
    const stamp = row.status === "resuelto" ? row.resolved_at : row.closed_at
    return inWindow(stamp, start.getTime(), end.getTime())
  })
  const main = rows.filter((row) => row.status === "resuelto" || row.status === "cerrado")
  const aside = rows.filter((row) => row.status === "rechazado" || row.status === "duplicado")
  const headers = ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Fechas/Tiempo"]
  const ticketWidths = [52, 88, 58, 48, 55, 94, 120]
  const mainRows = main.map((row) => rowCells(row, staff, doneDates(row)))
  const asideRows = aside.map((row) => rowCells(row, staff, asideDates(row)))
  const subtitle = `${fechaLarga(start.toISOString())} al ${fechaLarga(end.toISOString())}`
  const blocks = [
    { title: "Resueltas y cerradas", headers, rows: mainRows },
    { title: "Rechazadas y duplicadas", headers, rows: asideRows },
  ]
  const pdf = await buildReportPdf({
    title: "Informe anual",
    subtitle: `Colegio Montaigne de Sevilla · ${subtitle}`,
    counts: [
      ["Resueltas", String(main.filter((row) => row.status === "resuelto").length)],
      ["Cerradas", String(main.filter((row) => row.status === "cerrado").length)],
      ["Rechazadas", String(aside.filter((row) => row.status === "rechazado").length)],
      ["Duplicadas", String(aside.filter((row) => row.status === "duplicado").length)],
    ],
    tables: [
      { title: "Resueltas y cerradas", headers, rows: mainRows, widths: ticketWidths },
      { title: "Rechazadas y duplicadas", headers, rows: asideRows, widths: ticketWidths },
    ],
    tickets: await fichas([...main, ...aside], staff),
    closing: "Montaigne Fix · Colegio Montaigne de Sevilla · powered by Mundana Studio",
  })
  const subject = `Informe anual Montaigne Fix · ${subtitle}`
  return { subject, html: emailHtml(subject, `Del ${subtitle}.`, blocks), text: emailText(subject, `Del ${subtitle}.`, blocks), pdf, pdfName: `informe-anual-${madridNow(end).year}.pdf` }
}

async function lastAnnualEnd(): Promise<string | null> {
  const { data } = await db().from("report_runs").select("period_end").eq("kind", "anual").eq("ok", true).order("period_end", { ascending: false }).limit(1).maybeSingle()
  return typeof data?.period_end === "string" ? data.period_end : null
}

async function purge(now: Date): Promise<string> {
  const annualEnd = await lastAnnualEnd()
  if (!annualEnd) return "Sin informe anual previo: no se borra nada."
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12)
  const limit = Math.min(cutoff.getTime(), new Date(annualEnd).getTime())
  const limitIso = new Date(limit).toISOString()
  const { data } = await db()
    .from("tickets")
    .select("id, photo_path, status, resolved_at, closed_at")
    .in("status", ["resuelto", "cerrado"])
  const doomed = (data ?? []).filter((row) => {
    const stamp = row.status === "resuelto" ? row.resolved_at : row.closed_at
    return stamp && new Date(String(stamp)).getTime() <= limit
  })
  let removed = 0
  for (const row of doomed) {
    const paths = await listTicketPhotoPaths(String(row.id))
    const gone = await removeStorage(paths)
    if (!gone.ok) {
      console.error("purge-photo")
      continue
    }
    await db().from("email_log").delete().eq("ticket_id", row.id)
    const { error } = await db().from("tickets").delete().eq("id", row.id)
    if (!error) removed += 1
  }
  await db().from("email_log").delete().is("ticket_id", null).lte("created_at", limitIso)
  return `Borradas ${removed} incidencias.`
}

async function forgetOldLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  await db().from("login_attempts").delete().lt("created_at", cutoff)
  await db().from("submission_ips").delete().lt("created_at", cutoff)
  await db().from("security_notices").delete().lt("created_at", cutoff)
}

async function warnCurroAnnualFailed(): Promise<void> {
  const { data } = await db().from("staff").select("email").eq("slug", "curro").eq("active", true).maybeSingle()
  const to = typeof data?.email === "string" ? data.email.trim() : ""
  if (!to) return
  await sendNotice(
    to,
    "Montaigne Fix: el informe anual no se ha enviado",
    "El informe anual no ha salido. Hasta que no se envíe bien, no se borran los partes resueltos o cerrados de más de 12 meses. Los que siguen abiertos no se borran.",
  )
}

export async function runScheduledReports(): Promise<Record<string, unknown>> {
  const now = new Date()
  const clock = madridNow(now)
  if (clock.hour < 8) return { skipped: true }
  await forgetOldLimits()
  const result: Record<string, unknown> = {}
  if (clock.month === "07" && clock.day === "01" && !(await alreadyOk("anual", clock.year))) {
    const end = now
    const start = new Date(end)
    start.setUTCMonth(start.getUTCMonth() - 12)
    const pack = await annualPackage(start, end)
    const sent = await sendToManagers(pack)
    await markRun("anual", clock.year, end.toISOString(), sent.ok, sent.error ?? "Enviado a Fran y Curro")
    if (!sent.ok) await warnCurroAnnualFailed()
    result.anual = sent.ok
  }
  if (clock.weekday === "Wed" && !(await alreadyOk("semanal", clock.key))) {
    const end = now
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
    const pack = await weeklyPackage(start, end)
    const sent = await sendToManagers(pack)
    await markRun("semanal", clock.key, end.toISOString(), sent.ok, sent.error ?? "Enviado a Fran y Curro")
    result.semanal = sent.ok
  }
  if (!(await alreadyOk("purga", clock.key)) && (await lastAnnualEnd())) {
    const detail = await purge(now)
    await markRun("purga", clock.key, now.toISOString(), true, detail)
    result.purga = detail
  }
  return result
}
