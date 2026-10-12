// Formulario público. verify_jwt = false: no hay sesión, la anon key solo llama aquí.
// La service role no sale de esta función. El aviso a Fran no impide crear el parte.
import { createClient } from "npm:@supabase/supabase-js@2"
import { notifyNew, sendNotice } from "../_shared/email.ts"
import { clientIp } from "../_shared/http.ts"

const LIMITS = { name: 120, email: 254, description: 2000, location: 200, notes: 2000 }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MAX_PHOTO_BYTES = 1_500_000
const RATE_LIMIT = 3
const HOUR_LIMIT = 10
const DAY_IP_LIMIT = 30
const DAY_GLOBAL_LIMIT = 100
const WINDOW_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const BUSY = "Has enviado muchos partes seguidos. Inténtalo de nuevo en un rato."

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function chars(value: string): number {
  return [...value].length
}

function fieldError(fields: Record<string, string>): Response {
  const first = Object.values(fields)[0] ?? "Revisa los datos del formulario."
  return json(400, { ok: false, message: first, fields })
}


function madrid(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")}/${pick("month")}/${pick("year")} • ${pick("hour")}:${pick("minute")}`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors })
  if (req.method !== "POST") return json(405, { ok: false, message: "Método no permitido." })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json(400, { ok: false, message: "No se ha podido leer el formulario. Inténtalo de nuevo." })
  }

  const text = (key: string) => {
    const value = form.get(key)
    return typeof value === "string" ? value.trim() : ""
  }

  const name = text("name")
  const email = text("email").toLowerCase()
  const description = text("description")
  const location = text("location")
  const notes = text("notes")

  const fields: Record<string, string> = {}
  if (!name) fields.name = "Escribe tu nombre."
  else if (chars(name) > LIMITS.name) fields.name = `El nombre no puede pasar de ${LIMITS.name} caracteres.`
  if (!email || chars(email) > LIMITS.email || !EMAIL_RE.test(email)) {
    fields.email = "Revisa el email: tiene que ser del tipo nombre@grupomontaigne.com."
  }
  if (!description) fields.description = "Cuéntanos qué hay que reparar."
  else if (chars(description) > LIMITS.description) fields.description = `El texto no puede pasar de ${LIMITS.description} caracteres.`
  if (!location) fields.location = "Indica dónde está: aula, planta, patio, auditorio, baños…"
  else if (chars(location) > LIMITS.location) fields.location = `El lugar no puede pasar de ${LIMITS.location} caracteres.`
  if (chars(notes) > LIMITS.notes) fields.notes = `Las observaciones no pueden pasar de ${LIMITS.notes} caracteres.`
  if (Object.keys(fields).length > 0) return fieldError(fields)

  const photo = form.get("photo")
  let photoBytes: Uint8Array | null = null
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return json(413, { ok: false, message: "La foto es demasiado grande. Hazla de nuevo.", fields: { photo: "La foto es demasiado grande." } })
    }
    photoBytes = new Uint8Array(await photo.arrayBuffer())
    const jpeg = photoBytes.length >= 3 && photoBytes[0] === 0xff && photoBytes[1] === 0xd8 && photoBytes[2] === 0xff
    if (!jpeg) {
      return json(400, { ok: false, message: "La foto tiene que ser una imagen JPG.", fields: { photo: "La foto tiene que ser una imagen JPG." } })
    }
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const db = admin.schema("montaigne_fix")

  const { data: managers, error: managerError } = await db
    .from("staff")
    .select("slug, email")
    .eq("is_manager", true)
    .eq("active", true)
  if (managerError) {
    console.error("staff", managerError.code)
    return json(500, { ok: false, message: "No se ha podido enviar el parte. Inténtalo de nuevo más tarde." })
  }
  const exempt = (managers ?? []).some(
    (row) => typeof row.email === "string" && row.email.toLowerCase() === email,
  )

  if (!exempt) {
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data: recent, error: recentError } = await db
      .from("tickets")
      .select("created_at")
      .eq("requester_email", email)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
    if (recentError) {
      console.error("rate", recentError.code)
      return json(500, { ok: false, message: "No se ha podido enviar el parte. Inténtalo de nuevo más tarde." })
    }
    if ((recent?.length ?? 0) >= RATE_LIMIT) {
      const oldest = new Date(recent![0].created_at as string)
      const retryAt = new Date(oldest.getTime() + WINDOW_MS)
      return json(429, {
        ok: false,
        message:
          `Con este email ya hay ${RATE_LIMIT} partes en las últimas 24 horas. ` +
          `Podrás abrir otro el ${madrid(retryAt)}. Hasta entonces no se puede enviar otro parte.`,
      })
    }

    const ip = clientIp(req)
    const dayAgo = new Date(Date.now() - WINDOW_MS).toISOString()
    const hourAgo = new Date(Date.now() - HOUR_MS).toISOString()
    const hour = await db.from("submission_ips").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", hourAgo)
    const ipDay = await db.from("submission_ips").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", dayAgo)
    const globalDay = await db.from("submission_ips").select("id", { count: "exact", head: true }).gte("created_at", dayAgo)
    if (hour.error || ipDay.error || globalDay.error) {
      console.error("rate-ip", hour.error?.code ?? ipDay.error?.code ?? globalDay.error?.code ?? "error")
      return json(500, { ok: false, message: "No se ha podido enviar el parte. Inténtalo de nuevo más tarde." })
    }
    if ((globalDay.count ?? 0) >= DAY_GLOBAL_LIMIT) {
      const since = dayAgo
      const { data: sent } = await db.from("security_notices").select("id").eq("kind", "ticket_flood").gte("created_at", since).limit(1)
      if ((sent ?? []).length === 0) {
        await db.from("security_notices").insert({ kind: "ticket_flood" })
        const fran = (managers ?? []).find((row) => row.slug === "fran" && typeof row.email === "string")
        const to = typeof fran?.email === "string" ? fran.email : ""
        if (to) {
          await sendNotice(
            to,
            "Montaigne Fix: demasiados partes en un día",
            "Se han abierto más de 100 partes en un día. Los envíos nuevos quedan parados un rato, salvo los de Fran y Curro.",
          )
        }
      }
      return json(429, { ok: false, message: BUSY })
    }
    if ((hour.count ?? 0) >= HOUR_LIMIT || (ipDay.count ?? 0) >= DAY_IP_LIMIT) {
      return json(429, { ok: false, message: BUSY })
    }
  }

  const id = crypto.randomUUID()
  const photoPath = photoBytes ? `${id}.jpg` : null
  if (photoBytes && photoPath) {
    const { error: uploadError } = await admin.storage.from("montaigne-fix-fotos").upload(photoPath, photoBytes, {
      contentType: "image/jpeg",
      upsert: false,
    })
    if (uploadError) {
      console.error("upload", uploadError.message)
      return json(500, { ok: false, message: "No se ha podido guardar la foto. Inténtalo de nuevo." })
    }
  }

  const { error: insertError } = await db.from("tickets").insert({
    id,
    requester_name: name,
    requester_email: email,
    description,
    location,
    requester_notes: notes || null,
    photo_path: photoPath,
  })
  if (insertError) {
    console.error("insert", insertError.code)
    if (photoPath) await admin.storage.from("montaigne-fix-fotos").remove([photoPath])
    return json(500, { ok: false, message: "No se ha podido crear el parte. Inténtalo de nuevo." })
  }

  const { data: created } = await db.from("tickets").select("code, created_at").eq("id", id).maybeSingle()
  await notifyNew({
    ticketId: id,
    code: typeof created?.code === "string" ? created.code : "",
    name,
    email,
    description,
    location,
    notes,
    createdAt: typeof created?.created_at === "string" ? created.created_at : new Date().toISOString(),
    photo: photoBytes,
  })
  if (!exempt) {
    await db.from("submission_ips").insert({ ip: clientIp(req) })
  }
  const cutoff = new Date(Date.now() - 2 * WINDOW_MS).toISOString()
  await db.from("submission_ips").delete().lt("created_at", cutoff)
  await db.from("security_notices").delete().lt("created_at", cutoff)
  return json(200, { ok: true })
})
