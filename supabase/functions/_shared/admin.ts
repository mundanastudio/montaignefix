// Panel de gerencia. El actor se fija dentro de la función SQL, no aquí.
import { type Staff, requirePerson } from "./auth.ts"
import { HttpError, admin, db, handle, json, readJson, text } from "./http.ts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function uuid(value: unknown, message = "No encontramos esa incidencia."): string {
  const id = text(value)
  if (!UUID.test(id)) throw new HttpError(400, { ok: false, message })
  return id
}

export function optionalUuid(value: unknown): string | null {
  const id = text(value).trim()
  if (!id) return null
  if (!UUID.test(id)) throw new HttpError(400, { ok: false, message: "La persona asignada no es válida." })
  return id
}

function readable(error: { message?: string; code?: string }): { status: number; message: string } {
  const match = /MF:\s*([^\n]+)/.exec(error.message ?? "")
  if (!match) {
    console.error("rpc", error.code ?? "error")
    return { status: 500, message: "No se ha podido completar. Inténtalo de nuevo." }
  }
  const message = match[1].trim()
  if (error.code === "42501" || message.includes("sesión")) return { status: 401, message }
  if (error.code === "P0002" || message.startsWith("No encontramos")) return { status: 404, message }
  return { status: 400, message }
}

function shape(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {}
  const row = data as Record<string, unknown>
  if (row.counts && typeof row.counts === "object" && !Array.isArray(row.counts)) {
    const counts = { ...(row.counts as Record<string, unknown>) }
    const pendingCount = counts.pendientesCompra ?? 0
    delete counts.pendientesCompra
    return { ...row, counts, pendingCount }
  }
  if ("pendientesCompra" in row) {
    const { pendientesCompra, nuevas, p1Abiertas, resueltas, ...rest } = row
    return {
      ...rest,
      counts: { nuevas, p1Abiertas, resueltas },
      pendingCount: pendientesCompra ?? 0,
    }
  }
  return row
}

export async function rpc(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await db().rpc(fn, args)
  if (error) {
    const parsed = readable(error)
    throw new HttpError(parsed.status, { ok: false, message: parsed.message })
  }
  return shape(data)
}

export async function signPhoto(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || path === "") return null
  const { data, error } = await admin().storage.from("montaigne-fix-fotos").createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export function serveAdmin(run: (staff: Staff, body: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  Deno.serve((req) =>
    handle(req, async () => {
      const staff = await requirePerson(req, "admin", "is_manager")
      return json(200, { ok: true, ...(await run(staff, await readJson(req))) })
    }),
  )
}

export function lines(value: unknown): string[] {
  const raw = text(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (raw.length === 0) throw new HttpError(400, { ok: false, message: "Escribe al menos un artículo, uno por línea." })
  if (raw.length > 40) throw new HttpError(400, { ok: false, message: "Puedes enviar hasta 40 artículos a la vez." })
  if (raw.some((line) => [...line].length > 200)) {
    throw new HttpError(400, { ok: false, message: "Cada artículo puede tener como máximo 200 caracteres." })
  }
  return raw
}
