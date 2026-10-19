// Identidad de equipo y gestión.
// Las funciones que modifiquen un parte (fases 4 y 5) deben recibir el id que
// devuelve requireTeam/requireAdmin y llamar a montaigne_fix.set_actor() dentro
// de la MISMA función SQL que hace el cambio. Una llamada aparte no comparte
// transacción y el historial quedaría como "Sistema".
import { HttpError, bearer, db, text } from "./http.ts"

const encoder = new TextEncoder()
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const GLOBAL_FAILURES = 10
const DAY_MS = 24 * 60 * 60 * 1000

export interface Staff {
  id: string
  slug: string
  name: string
  is_manager: boolean
  is_technician: boolean
  is_combo?: boolean
}

type Credential = "pin" | string

interface TokenPayload {
  typ: "gate" | "team" | "admin"
  sub?: string
  exp: number
  ver: number
  cred: Credential
}

const ORDER = ["fran", "agustin", "andres", "curro"]

export function madrid(date: Date): string {
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

function bytesToB64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4))
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))
}

function sessionSecret(): string {
  const secret = Deno.env.get("MF_SESSION_SECRET") ?? ""
  if (secret.length < 32) {
    throw new HttpError(503, { ok: false, message: "El acceso todavía no está configurado." })
  }
  return secret
}

function days(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name))
  return Number.isFinite(value) && value > 0 && value <= 90 ? value : fallback
}

export function pinLength(): number {
  return Deno.env.get("MF_PIN_LENGTH") === "6" ? 6 : 4
}

function credentialOf(typ: TokenPayload["typ"], sub?: string): Credential {
  if (typ === "admin") {
    if (!sub || !passwordHash(sub)) {
      throw new HttpError(401, { ok: false, message: "Elige quién eres." })
    }
    return sub
  }
  return "pin"
}

function hashOf(credential: Credential): string {
  if (credential === "pin") return Deno.env.get("MF_TEAM_PIN_HASH") ?? ""
  return passwordHash(credential) ?? ""
}

/** HMAC corto del hash. La tabla guarda esto, nunca el hash. */
async function credentialFingerprint(hash: string): Promise<string> {
  const mac = await hmac(sessionSecret(), `mf-cred:${hash}`)
  return bytesToB64url(mac).slice(0, 22)
}

function expiredMessage(typ: TokenPayload["typ"]): string {
  if (typ === "admin") return "Tu sesión ha caducado, vuelve a introducir la contraseña."
  return "Tu sesión ha caducado, vuelve a introducir el PIN."
}

async function syncCredential(credential: Credential): Promise<number> {
  const hash = hashOf(credential)
  if (!hash.startsWith("pbkdf2_sha256$")) {
    throw new HttpError(503, { ok: false, message: "El acceso todavía no está configurado." })
  }
  const fingerprint = await credentialFingerprint(hash)
  const { data, error } = await db()
    .from("session_versions")
    .select("version, fingerprint")
    .eq("credential", credential)
    .maybeSingle()
  if (error || !data) {
    console.error("session-version", error?.code ?? "vacio")
    throw new HttpError(500, { ok: false, message: "No se ha podido comprobar el acceso. Inténtalo de nuevo." })
  }
  const version = Number(data.version)
  const current = typeof data.fingerprint === "string" ? data.fingerprint : ""
  if (current === fingerprint) return version
  const next = current === "" ? version : version + 1
  const { data: updated, error: updateError } = await db()
    .from("session_versions")
    .update({ version: next, fingerprint, updated_at: new Date().toISOString() })
    .eq("credential", credential)
    .eq("fingerprint", current)
    .select("version")
    .maybeSingle()
  if (updateError) {
    console.error("session-bump", updateError.code)
    throw new HttpError(500, { ok: false, message: "No se ha podido comprobar el acceso. Inténtalo de nuevo." })
  }
  if (updated) return Number(updated.version)
  const { data: again } = await db().from("session_versions").select("version").eq("credential", credential).maybeSingle()
  return Number(again?.version ?? next)
}

export async function bumpTeamSessions(): Promise<void> {
  const { data, error } = await db().from("session_versions").select("version").eq("credential", "pin").maybeSingle()
  if (error || !data) throw new HttpError(500, { ok: false, message: "No se han podido cerrar las sesiones. Inténtalo de nuevo." })
  const next = Number(data.version) + 1
  const { error: updateError } = await db()
    .from("session_versions")
    .update({ version: next, updated_at: new Date().toISOString() })
    .eq("credential", "pin")
    .eq("version", data.version)
  if (updateError) throw new HttpError(500, { ok: false, message: "No se han podido cerrar las sesiones. Inténtalo de nuevo." })
}

export async function signToken(typ: TokenPayload["typ"], sub?: string): Promise<string> {
  const lifetime = typ === "admin" ? days("MF_ADMIN_SESSION_DAYS", 7) : days("MF_TEAM_SESSION_DAYS", 30)
  const cred = credentialOf(typ, sub)
  const payload: TokenPayload = {
    typ,
    exp: Math.floor((Date.now() + lifetime * DAY_MS) / 1000),
    ver: await syncCredential(cred),
    cred,
  }
  if (sub) payload.sub = sub
  const body = bytesToB64url(encoder.encode(JSON.stringify(payload)))
  const signature = bytesToB64url(await hmac(sessionSecret(), body))
  return `${body}.${signature}`
}

export async function verifyToken(token: string, expected: TokenPayload["typ"][]): Promise<TokenPayload> {
  const [body, signature] = token.split(".")
  if (!body || !signature) throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  const valid = safeEqual(b64urlToBytes(signature), await hmac(sessionSecret(), body))
  if (!valid) throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  let payload: TokenPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as TokenPayload
  } catch {
    throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  }
  if (!expected.includes(payload.typ) || payload.exp * 1000 <= Date.now()) {
    throw new HttpError(401, { ok: false, message: expiredMessage(payload.typ === "admin" ? "admin" : "team") })
  }
  if (payload.cred !== "pin" && !passwordHash(payload.cred)) {
    throw new HttpError(401, { ok: false, message: expiredMessage(payload.typ) })
  }
  if (typeof payload.ver !== "number" || !Number.isInteger(payload.ver)) {
    throw new HttpError(401, { ok: false, message: expiredMessage(payload.typ) })
  }
  if (payload.typ === "admin" && payload.cred !== payload.sub) {
    throw new HttpError(401, { ok: false, message: expiredMessage("admin") })
  }
  if (payload.typ !== "admin" && payload.cred !== "pin") {
    throw new HttpError(401, { ok: false, message: expiredMessage("team") })
  }
  const version = await syncCredential(payload.cred)
  if (payload.ver !== version) throw new HttpError(401, { ok: false, message: expiredMessage(payload.typ) })
  return payload
}

/** Hash creado por scripts/hash-secret.mjs: pbkdf2_sha256$vueltas$sal$hash */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algorithm, rounds, salt, hash] = stored.split("$")
  const iterations = Number(rounds)
  if (algorithm !== "pbkdf2_sha256" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
    return false
  }
  if (!salt || !hash) return false
  const saltBytes = b64urlToBytes(salt)
  const expected = b64urlToBytes(hash)
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "PBKDF2" }, false, ["deriveBits"])
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    ),
  )
  return safeEqual(derived, expected)
}

export async function assertConfigured(hash: string | undefined): Promise<string> {
  if (!hash || !hash.startsWith("pbkdf2_sha256$")) {
    throw new HttpError(503, { ok: false, message: "El acceso todavía no está configurado." })
  }
  sessionSecret()
  return hash
}

async function globalFailureState(kind: "pin" | "password"): Promise<{ count: number; newest: string | null }> {
  const since = new Date(Date.now() - LOCK_MS).toISOString()
  const { count, error } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("success", false)
    .gte("created_at", since)
  if (error) {
    console.error("attempts", error.code)
    throw new HttpError(500, { ok: false, message: "No se ha podido comprobar el acceso. Inténtalo de nuevo." })
  }
  const { data } = await db()
    .from("login_attempts")
    .select("created_at")
    .eq("kind", kind)
    .eq("success", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
  const newest = data?.[0]?.created_at
  return { count: count ?? 0, newest: typeof newest === "string" ? newest : null }
}

async function failureRows(kind: "pin" | "password", subject: string) {
  const since = new Date(Date.now() - LOCK_MS).toISOString()
  const { data, error } = await db()
    .from("login_attempts")
    .select("success, created_at")
    .eq("kind", kind)
    .eq("subject", subject)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8)
  if (error) {
    console.error("attempts", error.code)
    throw new HttpError(500, { ok: false, message: "No se ha podido comprobar el acceso. Inténtalo de nuevo." })
  }
  return data ?? []
}

function consecutiveFailures(rows: { success: boolean; created_at: string }[]): number {
  let failures = 0
  for (const row of rows) {
    if (row.success) break
    failures++
  }
  return failures
}

export async function assertNotLocked(kind: "pin" | "password", subject: string): Promise<void> {
  const own = await failureRows(kind, subject)
  if (consecutiveFailures(own) >= MAX_FAILURES) {
    const until = new Date(new Date(own[0]!.created_at).getTime() + LOCK_MS)
    throw new HttpError(429, {
      ok: false,
      message: `Demasiados intentos. Podrás probar de nuevo el ${madrid(until)}.`,
    })
  }
  const global = await globalFailureState(kind)
  if (global.count >= GLOBAL_FAILURES) {
    const until = new Date(new Date(global.newest ?? Date.now()).getTime() + LOCK_MS)
    throw new HttpError(429, {
      ok: false,
      message: `Demasiados intentos. Podrás probar de nuevo el ${madrid(until)}.`,
    })
  }
}

async function notifyLock(kind: "pin" | "password"): Promise<void> {
  const since = new Date(Date.now() - LOCK_MS).toISOString()
  const notice = kind === "pin" ? "pin_lock" : "password_lock"
  const { data: sent } = await db().from("security_notices").select("id").eq("kind", notice).gte("created_at", since).limit(1)
  if ((sent ?? []).length > 0) return
  const { error } = await db().from("security_notices").insert({ kind: notice })
  if (error) {
    console.error("notice", error.code)
    return
  }
  const { data } = await db().from("staff").select("email").eq("slug", "fran").maybeSingle()
  const to = typeof data?.email === "string" ? data.email : ""
  if (!to) return
  const { sendNotice } = await import("./email.ts")
  const text = kind === "pin"
    ? "Alguien ha fallado el PIN del equipo muchas veces seguidas. La entrada con PIN queda bloqueada 15 minutos. Las sesiones ya abiertas siguen, y la contraseña de gestión no se bloquea por esto."
    : "Alguien ha fallado la contraseña de gestión muchas veces seguidas. La entrada con contraseña queda bloqueada 15 minutos. Las sesiones ya abiertas siguen, y el PIN del equipo no se bloquea por esto."
  await sendNotice(to, kind === "pin" ? "Montaigne Fix: PIN bloqueado un rato" : "Montaigne Fix: contraseña de gestión bloqueada un rato", text)
}

export async function recordAttempt(kind: "pin" | "password", subject: string, success: boolean): Promise<void> {
  const { error } = await db().from("login_attempts").insert({ kind, subject, success })
  if (error) console.error("record", error.code)
  const cutoff = new Date(Date.now() - 2 * DAY_MS).toISOString()
  await db().from("login_attempts").delete().lt("created_at", cutoff)
  await db().from("security_notices").delete().lt("created_at", cutoff)
  if (success) return
  const global = await globalFailureState(kind)
  if (global.count >= GLOBAL_FAILURES) await notifyLock(kind)
}

export async function loadStaff(slug: string): Promise<Staff | null> {
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(slug)) return null
  const { data, error } = await db()
    .from("staff")
    .select("id, slug, name, is_manager, is_technician, is_combo")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle()
  if (error) {
    console.error("staff", error.code)
    throw new HttpError(500, { ok: false, message: "No se ha podido comprobar el acceso. Inténtalo de nuevo." })
  }
  return (data as Staff | null) ?? null
}

export async function technicians(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await db()
    .from("staff")
    .select("slug, name")
    .eq("active", true)
    .eq("is_technician", true)
    .eq("is_combo", false)
  if (error) throw new HttpError(500, { ok: false, message: "No se ha podido preparar el acceso. Inténtalo de nuevo." })
  return ((data ?? []) as { slug: string; name: string }[]).sort(
    (a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug),
  )
}

const PASSWORD_HASH: Record<string, string> = {
  fran: "MF_ADMIN_PASSWORD_HASH_FRAN",
  curro: "MF_ADMIN_PASSWORD_HASH_CURRO",
  carlos: "MF_ADMIN_PASSWORD_HASH_CARLOS",
}

export function passwordHash(slug: string): string | undefined {
  const name = PASSWORD_HASH[slug]
  return name ? Deno.env.get(name) : undefined
}

export async function requireToken(req: Request, expected: TokenPayload["typ"][]): Promise<TokenPayload> {
  const token = bearer(req)
  if (!token) {
    const admin = expected.length === 1 && expected[0] === "admin"
    throw new HttpError(401, { ok: false, message: expiredMessage(admin ? "admin" : "team") })
  }
  return verifyToken(token, expected)
}

export async function requirePerson(req: Request, typ: "team" | "admin", flag: "is_technician" | "is_manager"): Promise<Staff> {
  const payload = await requireToken(req, [typ])
  const staff = await loadStaff(text(payload.sub))
  if (!staff?.[flag]) throw new HttpError(401, { ok: false, message: expiredMessage(typ) })
  return staff
}
