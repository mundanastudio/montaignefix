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

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const RATE_LIMIT_NOTICE =
  "Con el mismo email puedes abrir hasta 3 partes cada 24 horas. Si llegas al límite, tendrás que esperar a que pasen 24 horas para abrir otro."

export const PHOTO_WARNING = "No fotografíes a alumnos ni a otras personas. Fotografía solo el desperfecto."

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
  const email = input.email.trim()
  const description = input.description.trim()
  const location = input.location.trim()
  const notes = input.notes.trim()

  if (!name) errors.name = "Escribe tu nombre."
  else if (charCount(name) > LIMITS.name) errors.name = `El nombre no puede pasar de ${LIMITS.name} caracteres.`

  if (!email) errors.email = "Escribe tu email: te avisaremos cuando esté solucionado."
  else if (charCount(email) > LIMITS.email || !EMAIL_RE.test(email)) {
    errors.email = "Revisa el email: tiene que ser del tipo nombre@grupomontaigne.com."
  }

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
