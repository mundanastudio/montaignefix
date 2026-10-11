import { teamToken } from "./authApi"

export interface TeamFailure {
  ok: false
  message: string
  expired: boolean
}

export type TeamSuccess<T> = { ok: true } & T
export type TeamResponse<T> = TeamSuccess<T> | TeamFailure

export async function teamPost<T>(name: string, body: Record<string, unknown> = {}): Promise<TeamResponse<T>> {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const token = teamToken()
  if (!base || !key) return { ok: false, message: "La aplicación no está configurada.", expired: false }
  if (!token) return { ok: false, message: "La sesión ha caducado. Vuelve a entrar.", expired: true }

  let response: Response
  try {
    response = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, message: "No hay conexión. Inténtalo de nuevo.", expired: false }
  }

  const payload = (await response.json().catch(() => null)) as (TeamSuccess<T> & { message?: string }) | null
  if (response.status === 401) {
    return {
      ok: false,
      message: typeof payload?.message === "string" ? payload.message : "La sesión ha caducado. Vuelve a entrar.",
      expired: true,
    }
  }
  if (!response.ok || !payload?.ok) {
    return {
      ok: false,
      message: typeof payload?.message === "string" ? payload.message : "No se ha podido completar. Inténtalo de nuevo.",
      expired: false,
    }
  }
  return payload
}
