import { normalizeEmail } from "../../supabase/functions/_shared/allowedEmails"

export class NetworkError extends Error {
  constructor() {
    super("No se ha podido enviar. Comprueba tu conexión e inténtalo de nuevo. Tus datos siguen en el formulario.")
    this.name = "NetworkError"
  }
}

export interface CreateTicketInput {
  name: string
  email: string
  description: string
  location: string
  notes: string
}

export interface CreateTicketResult {
  ok: true
}

export interface CreateTicketFailure {
  ok: false
  message: string
  fields?: Record<string, string>
}

export async function createTicket(
  input: CreateTicketInput,
  photos: Blob[],
): Promise<CreateTicketResult | CreateTicketFailure> {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) {
    return {
      ok: false,
      message: "La aplicación no está configurada. Falta la dirección del servidor.",
    }
  }

  const body = new FormData()
  body.set("name", input.name.trim())
  body.set("email", normalizeEmail(input.email))
  body.set("description", input.description.trim())
  body.set("location", input.location.trim())
  body.set("notes", input.notes.trim())
  photos.forEach((photo, index) => body.append("photo", photo, `foto-${index + 1}.jpg`))

  let response: Response
  try {
    response = await fetch(`${base}/functions/v1/create-ticket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      body,
    })
  } catch {
    throw new NetworkError()
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; fields?: Record<string, string> }
    | null

  if (!response.ok || !payload?.ok) {
    return {
      ok: false,
      message:
        payload?.message ??
        "No se ha podido enviar el parte. Inténtalo de nuevo. Tus datos siguen en el formulario.",
      fields: payload?.fields,
    }
  }

  return { ok: true }
}
