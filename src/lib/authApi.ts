const TEAM = "mf.team"
const GATE = "mf.gate"
const PEOPLE = "mf.team.people"
const ADMIN = "mf.admin"

export interface Person {
  slug: string
  name: string
}

export interface AuthFailure {
  ok: false
  message: string
}

export type AuthResult<T> = ({ ok: true } & T) | AuthFailure

function asFailure(result: Record<string, unknown> | AuthFailure): AuthFailure | null {
  if (result.ok === false) {
    return { ok: false, message: typeof result.message === "string" ? result.message : "No se ha podido entrar." }
  }
  return null
}

function endpoint(name: string): { url: string; key: string } | AuthFailure {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return { ok: false, message: "La aplicación no está configurada." }
  return { url: `${base}/functions/v1/${name}`, key }
}

async function post(
  name: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<Record<string, unknown> | AuthFailure> {
  const target = endpoint(name)
  if ("ok" in target) return target
  let response: Response
  try {
    response = await fetch(target.url, {
      method: "POST",
      headers: {
        apikey: target.key,
        Authorization: `Bearer ${token ?? target.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, message: "No hay conexión. Inténtalo de nuevo." }
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !payload?.ok) {
    return { ok: false, message: typeof payload?.message === "string" ? payload.message : "No se ha podido entrar." }
  }
  return payload
}

export function teamToken(): string | null {
  return localStorage.getItem(TEAM)
}
export function teamGate(): string | null {
  return localStorage.getItem(GATE)
}
export function adminToken(): string | null {
  return localStorage.getItem(ADMIN)
}
export function savedPeople(): Person[] {
  try {
    const value = JSON.parse(localStorage.getItem(PEOPLE) ?? "[]") as Person[]
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function rememberPeople(people: unknown) {
  if (Array.isArray(people)) localStorage.setItem(PEOPLE, JSON.stringify(people))
}

export function saveTeam(token: string, people?: unknown) {
  localStorage.setItem(TEAM, token)
  if (people) rememberPeople(people)
}
export function saveGate(gate: string, people: unknown) {
  localStorage.setItem(GATE, gate)
  rememberPeople(people)
}
export function clearTeam() {
  localStorage.removeItem(TEAM)
  localStorage.removeItem(GATE)
  localStorage.removeItem(PEOPLE)
}
export function saveAdmin(token: string) {
  localStorage.setItem(ADMIN, token)
}
export function clearAdmin() {
  localStorage.removeItem(ADMIN)
}

export async function loginWithPin(pin: string): Promise<AuthResult<{ people: Person[] }>> {
  const result = await post("team-login", { pin })
  const failed = asFailure(result)
  if (failed) return failed
  const payload = result as { gate?: string; people?: Person[] }
  if (!payload.gate) return { ok: false as const, message: "No se ha podido entrar." }
  saveGate(payload.gate, payload.people ?? [])
  return { ok: true as const, people: payload.people ?? [] }
}

export async function selectPerson(slug: string): Promise<AuthResult<{ person: Person; people: Person[] }>> {
  const token = teamToken() ?? teamGate()
  if (!token) return { ok: false, message: "Vuelve a introducir el PIN." }
  const result = await post("team-select", { slug }, token)
  const failed = asFailure(result)
  if (failed) return failed
  const payload = result as { token?: string; person?: Person; people?: Person[] }
  if (!payload.token || !payload.person) return { ok: false as const, message: "No se ha podido elegir la persona." }
  saveTeam(payload.token, payload.people)
  return { ok: true as const, person: payload.person, people: payload.people ?? savedPeople() }
}

export async function loginAdmin(slug: string, password: string): Promise<AuthResult<{ person: Person }>> {
  const result = await post("admin-login", { slug, password })
  const failed = asFailure(result)
  if (failed) return failed
  const payload = result as { token?: string; person?: Person }
  if (!payload.token || !payload.person) return { ok: false as const, message: "No se ha podido entrar." }
  saveAdmin(payload.token)
  return { ok: true as const, person: payload.person }
}

export async function currentSession(kind: "team" | "admin"): Promise<AuthResult<{ person: Person; people: Person[] }>> {
  const token = kind === "team" ? teamToken() : adminToken()
  if (!token) return { ok: false, message: "" }
  const result = await post("session", {}, token)
  const failed = asFailure(result)
  if (failed) return failed
  const payload = result as { session?: Person & { kind: string }; people?: Person[] }
  if (!payload.session || payload.session.kind !== kind) return { ok: false as const, message: "La sesión ha caducado. Vuelve a entrar." }
  if (payload.people) rememberPeople(payload.people)
  return { ok: true as const, person: { slug: payload.session.slug, name: payload.session.name }, people: payload.people ?? [] }
}
