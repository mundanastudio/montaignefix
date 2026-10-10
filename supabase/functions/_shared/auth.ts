// Identidad de equipo y gestión.
// Las funciones que modifiquen un parte (fases 4 y 5) deben recibir el id que
// devuelve requireTeam/requireAdmin y llamar a montaigne_fix.set_actor() dentro
// de la MISMA función SQL que hace el cambio. Una llamada aparte no comparte
// transacción y el historial quedaría como "Sistema".
import { HttpError, bearer, db, text } from "./http.ts"

const encoder = new TextEncoder()
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const DAY_MS = 24 * 60 * 60 * 1000

export interface Staff {
  id: string
  slug: string
  name: string
  is_manager: boolean
  is_technician: boolean
}

interface TokenPayload {
  typ: "gate" | "team" | "admin"
  sub?: string
  exp: number
}

const ORDER = ["fran", "agustin", "andres", "curro"]

export function madrid(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date)
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

export async function signToken(typ: TokenPayload["typ"], sub?: string): Promise<string> {
  const lifetime = typ === "admin" ? days("MF_ADMIN_SESSION_DAYS", 7) : days("MF_TEAM_SESSION_DAYS", 30)
  const payload: TokenPayload = { typ, exp: Math.floor((Date.now() + lifetime * DAY_MS) / 1000) }
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
    throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  }
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

async function recentAttempts(kind: "pin" | "password", subject: string) {
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

export async function assertNotLocked(kind: "pin" | "password", subject: string): Promise<void> {
  const rows = await recentAttempts(kind, subject)
  let failures = 0
  for (const row of rows) {
    if (row.success) break
    failures++
  }
  if (failures < MAX_FAILURES) return
  const newest = rows[0]?.created_at
  const until = new Date(new Date(newest as string).getTime() + LOCK_MS)
  throw new HttpError(429, {
    ok: false,
    message: `Demasiados intentos. Podrás probar de nuevo el ${madrid(until)}.`,
  })
}

export async function recordAttempt(kind: "pin" | "password", subject: string, success: boolean): Promise<void> {
  const { error } = await db().from("login_attempts").insert({ kind, subject, success })
  if (error) console.error("record", error.code)
  const cutoff = new Date(Date.now() - 2 * DAY_MS).toISOString()
  await db().from("login_attempts").delete().lt("created_at", cutoff)
}

export async function loadStaff(slug: string): Promise<Staff | null> {
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(slug)) return null
  const { data, error } = await db()
    .from("staff")
    .select("id, slug, name, is_manager, is_technician")
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
  const { data, error } = await db().from("staff").select("slug, name").eq("active", true).eq("is_technician", true)
  if (error) throw new HttpError(500, { ok: false, message: "No se ha podido preparar el acceso. Inténtalo de nuevo." })
  return ((data ?? []) as { slug: string; name: string }[]).sort(
    (a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug),
  )
}

const PASSWORD_HASH: Record<string, string> = {
  fran: "MF_ADMIN_PASSWORD_HASH_FRAN",
  curro: "MF_ADMIN_PASSWORD_HASH_CURRO",
}

export function passwordHash(slug: string): string | undefined {
  const name = PASSWORD_HASH[slug]
  return name ? Deno.env.get(name) : undefined
}

export async function requireToken(req: Request, expected: TokenPayload["typ"][]): Promise<TokenPayload> {
  const token = bearer(req)
  if (!token) throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  return verifyToken(token, expected)
}

export async function requirePerson(req: Request, typ: "team" | "admin", flag: "is_technician" | "is_manager"): Promise<Staff> {
  const payload = await requireToken(req, [typ])
  const staff = await loadStaff(text(payload.sub))
  if (!staff?.[flag]) throw new HttpError(401, { ok: false, message: "La sesión ha caducado. Vuelve a entrar." })
  return staff
}
