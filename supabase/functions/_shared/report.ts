import { sendReport } from "./email.ts"
import { escapeHtml, fechaLarga } from "./email-render.mjs"
import { admin, db } from "./http.ts"
import { buildReportPdf, type PdfTicket } from "./report-pdf.ts"

const OPEN = ["nuevo", "asignado", "en_curso", "en_espera"]
const TERMINAL = ["cerrado", "rechazado", "duplicado"]
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

function when(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")}/${pick("month")}/${pick("year")} · ${pick("hour")}:${pick("minute")}`
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

async function managerEmails(): Promise<string[]> {
  const { data } = await db().from("staff").select("email").eq("is_manager", true).eq("active", true)
  const list = (data ?? []).map((row) => (typeof row.email === "string" ? row.email.trim() : "")).filter(Boolean)
  return [...new Set(list)]
}

function historyLine(type: string, oldValue: string | null, newValue: string | null): string {
  if (type === "creado") return "Abrió la incidencia"
  if (type === "estado") return `Cambió el estado de ${status(oldValue ?? "")} a ${status(newValue ?? "")}`
  if (type === "prioridad") return `Cambió la prioridad de ${priority(oldValue)} a ${priority(newValue)}`
  if (type === "asignacion") return `Asignación: ${oldValue ?? "nadie"} → ${newValue ?? "nadie"}`
  if (type === "nota") return newValue === "interna" ? "Añadió una observación interna" : "Añadió una observación de gestión"
  if (type === "material_solicitado") return `Pidió material: ${newValue ?? ""}`
  if (type === "material_comprado") return `Marcó como comprado: ${newValue ?? ""}`
  if (type === "material_repuesto") return `Volvió a dejar pendiente: ${oldValue ?? ""}`
  if (type === "material_borrado") return `Borró el material: ${oldValue ?? ""}`
  if (type === "material_editado") return `Cambió el material «${oldValue ?? ""}» por «${newValue ?? ""}»`
  return "Registró un cambio"
}

async function fichas(rows: Row[], staff: Map<string, string>): Promise<PdfTicket[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const [materials, notes, events] = await Promise.all([
    db().from("shopping_items").select("ticket_id, description, status, created_at, purchased_at, requested_by, purchased_by").in("ticket_id", ids),
    db().from("ticket_notes").select("ticket_id, kind, body, created_at, author_id").in("ticket_id", ids).order("created_at", { ascending: false }),
    db().from("ticket_events").select("ticket_id, event_type, actor_label, old_value, new_value, created_at").in("ticket_id", ids).order("created_at", { ascending: false }),
  ])
  const byTicket = (list: Array<Record<string, unknown>> | null) => {
    const map = new Map<string, Array<Record<string, unknown>>>()
    for (const item of list ?? []) {
      const key = String(item.ticket_id)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }
  const materialMap = byTicket(materials.data)
  const noteMap = byTicket(notes.data)
  const eventMap = byTicket(events.data)
  return rows.map((row) => ({
    code: row.code,
    title: clip(row.description, 90),
    meta: `${row.location} · ${priority(row.priority)} · ${status(row.status)} · ${staff.get(row.assigned_to ?? "") ?? "Sin asignar"}`,
    facts: [
      ["Solicitante", `${row.requester_name} · ${row.requester_email}`],
      ["Reparación", row.description],
      ["Observaciones del solicitante", row.requester_notes?.trim() || "Sin observaciones"],
      ["Abierta", when(row.created_at)],
      ["Asignada", when(row.assigned_at)],
      ["Resuelta", when(row.resolved_at)],
      ["Cerrada", when(row.closed_at)],
    ],
    materials: (materialMap.get(row.id) ?? []).map((item) => [
      String(item.description),
      item.status === "comprado" ? "Comprado" : "Pendiente",
      staff.get(String(item.status === "comprado" ? item.purchased_by : item.requested_by)) ?? "",
      when(String(item.status === "comprado" ? item.purchased_at : item.created_at)),
    ]),
    notes: (noteMap.get(row.id) ?? []).map((item) => {
      const kind = item.kind === "interna" ? "Interna" : "Gestión"
      return `${kind} · ${staff.get(String(item.author_id)) ?? "Equipo"} · ${when(String(item.created_at))} — ${item.body}`
    }),
    history: (eventMap.get(row.id) ?? []).map(
      (item) => `${when(String(item.created_at))} · ${item.actor_label} ${historyLine(String(item.event_type), item.old_value ? String(item.old_value) : null, item.new_value ? String(item.new_value) : null)}.`,
    ),
  }))
}

async function pendingShopping(staff: Map<string, string>) {
  const { data } = await db()
    .from("shopping_items")
    .select("description, created_at, requested_by, ticket_id")
    .eq("status", "pendiente")
    .order("created_at", { ascending: true })
  const ids = [...new Set((data ?? []).map((item) => String(item.ticket_id)))]
  const { data: tickets } = ids.length
    ? await db().from("tickets").select("id, code, location").in("id", ids)
    : { data: [] }
  const places = new Map((tickets ?? []).map((ticket) => [String(ticket.id), ticket]))
  return (data ?? []).map((item) => {
    const ticket = places.get(String(item.ticket_id))
    return [
      String(item.description),
      `${ticket?.code ?? "—"} · ${ticket?.location ?? ""}`,
      staff.get(String(item.requested_by)) ?? "",
      when(String(item.created_at)),
    ]
  })
}

function inWindow(iso: string | null, start: number, end: number): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return time >= start && time < end
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
            `<tr>${row.map((cell) => `<td style="padding:8px;border-bottom:1px solid #e2e2e2;vertical-align:top;">${escapeHtml(cell)}</td>`).join("")}</tr>`,
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
  const to = await managerEmail()
  if (!to) return { ok: false, error: "Fran no tiene un correo configurado." }
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  const built = await weeklyPackage(start, end)
  const result = await sendReport({ to, ...built })
  return result
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
  const shopping = await pendingShopping(staff)
  const subtitle = `${fechaLarga(start.toISOString())} al ${fechaLarga(end.toISOString())}`
  const headers = ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Fechas"]
  const doneRows = done.map((row) =>
    rowCells(row, staff, `Abierta ${when(row.created_at)}\n${row.status === "cerrado" ? "Cerrada" : "Resuelta"} ${when(row.closed_at ?? row.resolved_at)}`),
  )
  const openRows = open.map((row) => rowCells(row, staff, when(row.created_at)))
  const blocks = [
    { title: "Resueltas y cerradas esta semana", headers, rows: doneRows.map((row) => row.map((cell) => cell.replace(/\n/g, " · "))) },
    { title: "Siguen abiertas", headers, rows: openRows },
    { title: "Pendiente de comprar", headers: ["Artículo", "Incidencia", "Quién lo pidió", "Desde"], rows: shopping },
  ]
  const pdf = await buildReportPdf({
    title: "Informe semanal",
    subtitle: `Colegio Montaigne de Sevilla · ${subtitle}`,
    counts: [
      ["Cerradas esta semana", String(done.filter((row) => row.status === "cerrado").length)],
      ["Resueltas, sin cerrar", String(resolvedOpen.length)],
      ["Siguen abiertas", String(open.length)],
      ["Material pendiente", String(shopping.length)],
    ],
    tables: [
      { title: "Resueltas y cerradas esta semana", headers, rows: doneRows, widths: [58, 120, 70, 52, 58, 70, 87] },
      { title: "Siguen abiertas", headers, rows: openRows, widths: [58, 140, 78, 62, 62, 70, 45] },
      { title: "Pendiente de comprar", headers: ["Artículo", "Incidencia", "Quién lo pidió", "Desde"], rows: shopping, widths: [160, 160, 110, 85] },
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
  const headers = ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Fecha"]
  const mainRows = main.map((row) => rowCells(row, staff, when(row.closed_at ?? row.resolved_at)))
  const asideRows = aside.map((row) => rowCells(row, staff, when(row.closed_at)))
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
      { title: "Resueltas y cerradas", headers, rows: mainRows, widths: [58, 130, 78, 52, 58, 70, 69] },
      { title: "Rechazadas y duplicadas", headers, rows: asideRows, widths: [58, 130, 78, 52, 58, 70, 69] },
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
  const { data } = await db()
    .from("tickets")
    .select("id, photo_path, status, resolved_at, closed_at")
    .in("status", ["resuelto", ...TERMINAL])
  const doomed = (data ?? []).filter((row) => {
    const stamp = row.status === "resuelto" ? row.resolved_at : row.closed_at
    return stamp && new Date(String(stamp)).getTime() <= limit
  })
  for (const row of doomed) {
    if (typeof row.photo_path === "string" && row.photo_path) {
      await admin().storage.from("montaigne-fix-fotos").remove([row.photo_path])
    }
    await db().from("tickets").delete().eq("id", row.id)
  }
  return `Borradas ${doomed.length} incidencias.`
}

export async function runScheduledReports(): Promise<Record<string, unknown>> {
  const now = new Date()
  const clock = madridNow(now)
  if (clock.hour < 8) return { skipped: true }
  const result: Record<string, unknown> = {}
  if (clock.month === "07" && clock.day === "01" && !(await alreadyOk("anual", clock.year))) {
    const end = now
    const start = new Date(end)
    start.setUTCMonth(start.getUTCMonth() - 12)
    const pack = await annualPackage(start, end)
    const recipients = await managerEmails()
    let ok = recipients.length > 0
    const errors: string[] = []
    for (const to of recipients) {
      const sent = await sendReport({ to, ...pack })
      if (!sent.ok) {
        ok = false
        errors.push(sent.error ?? "fallo")
      }
    }
    await markRun("anual", clock.year, end.toISOString(), ok, errors.join(" ") || `Enviado a ${recipients.length}`)
    result.anual = ok
  }
  if (clock.weekday === "Wed" && !(await alreadyOk("semanal", clock.key))) {
    const end = now
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
    const pack = await weeklyPackage(start, end)
    const to = await managerEmail()
    const sent = await sendReport({ to, ...pack })
    await markRun("semanal", clock.key, end.toISOString(), sent.ok, sent.error ?? "Enviado a Fran")
    result.semanal = sent.ok
  }
  if (!(await alreadyOk("purga", clock.key)) && (await lastAnnualEnd())) {
    const detail = await purge(now)
    await markRun("purga", clock.key, now.toISOString(), true, detail)
    result.purga = detail
  }
  return result
}
