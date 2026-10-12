import { requesterEmailFieldError } from "../../supabase/functions/_shared/allowedEmails"

/** Límites alineados con los CHECK de montaigne_fix.tickets y con la Edge Function create-ticket. */
export const LIMITS = {
  name: 120,
  email: 254,
  description: 2000,
  location: 200,
  notes: 2000,
  /** Objetivo de compresión en el navegador. */
  photoBytes: 500 * 1024,
} as const

export const PHOTO_WARNING = "No fotografíes a alumnos ni a otras personas. Fotografía solo el desperfecto."

export const REVIEW_MESSAGE = "Revisa los campos marcados en rojo."

export interface TicketInput {
  name: string
  email: string
  description: string
  location: string
  notes: string
  rgpd: boolean
}

export function charCount(value: string): number {
  return [...value].length
}

/** Errores por campo, en español. Objeto vacío si todo es válido. */
export function validateTicket(input: TicketInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  const description = input.description.trim()
  const location = input.location.trim()
  const notes = input.notes.trim()

  if (!name) errors.name = "Escribe tu nombre."
  else if (charCount(name) > LIMITS.name) errors.name = `El nombre no puede pasar de ${LIMITS.name} caracteres.`

  const emailError = requesterEmailFieldError(input.email)
  if (emailError) errors.email = emailError

  if (!description) errors.description = "Cuéntanos qué hay que reparar."
  else if (charCount(description) > LIMITS.description) {
    errors.description = `El texto no puede pasar de ${LIMITS.description} caracteres.`
  }

  if (!location) errors.location = "Indica dónde está: aula, planta, patio, auditorio, baños…"
  else if (charCount(location) > LIMITS.location) {
    errors.location = `El lugar no puede pasar de ${LIMITS.location} caracteres.`
  }

  if (charCount(notes) > LIMITS.notes) errors.notes = `Las observaciones no pueden pasar de ${LIMITS.notes} caracteres.`

  if (!input.rgpd) errors.rgpd = "Marca la casilla para poder enviar el parte."

  return errors
}
