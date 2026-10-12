import { adminToken } from "./authApi"

export interface AdminFailure {
  ok: false
  message: string
  expired: boolean
}

export type AdminSuccess<T> = { ok: true } & T
export type AdminResponse<T> = AdminSuccess<T> | AdminFailure

async function adminRequest<T>(name: string, init: RequestInit): Promise<AdminResponse<T>> {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const token = adminToken()
  if (!base || !key) return { ok: false, message: "La aplicación no está configurada.", expired: false }
  if (!token) return { ok: false, message: "La sesión ha caducado. Vuelve a entrar.", expired: true }

  let response: Response
  try {
    response = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })
  } catch {
    return { ok: false, message: "No hay conexión. Inténtalo de nuevo.", expired: false }
  }

  const payload = (await response.json().catch(() => null)) as (AdminSuccess<T> & { message?: string }) | null
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

export function adminPost<T>(name: string, body: Record<string, unknown> = {}): Promise<AdminResponse<T>> {
  return adminRequest<T>(name, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export function adminUpload<T>(name: string, body: FormData): Promise<AdminResponse<T>> {
  return adminRequest<T>(name, { body })
}
