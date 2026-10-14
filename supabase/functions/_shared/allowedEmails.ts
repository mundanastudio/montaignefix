/** Único sitio: dominios y excepción del formulario público. Lo leen create-ticket y el frontend. */
export const ALLOWED_EMAIL_DOMAINS = [
  "grupomontaigne.com",
  "grupomontaignesevilla.com",
  "colegiomontaignesevilla.com",
  "mundana.us",
] as const

export const ALLOWED_EMAIL_EXCEPTIONS = [
  "curromena89@gmail.com",
  "andrescanorodriguez@gmail.com",
  "agumasero@gmail.com",
  "patriciacastilloorozco33@gmail.com",
  "susanacrespomarquez@gmail.com",
  "remelucia78@gmail.com",
  "16.11.96.maria@gmail.com",
  "scmary97@gmail.com",
] as const

/** Gmail concretos: pueden abrir partes y no tienen tope de 3/24 h ni de red. El resto de Gmail no entra. */
export const UNLIMITED_REQUESTER_EMAILS = [
  "andrescanorodriguez@gmail.com",
  "agumasero@gmail.com",
] as const

/** Gmail concretos: entran y pueden abrir 10 partes / 24 h. No cuentan para el tope de red. */
export const RAISED_REQUESTER_LIMIT = 10
export const RAISED_REQUESTER_EMAILS = [
  "patriciacastilloorozco33@gmail.com",
  "susanacrespomarquez@gmail.com",
  "remelucia78@gmail.com",
  "16.11.96.maria@gmail.com",
  "scmary97@gmail.com",
] as const

export const DEFAULT_REQUESTER_LIMIT = 3

export const EMAIL_DOMAIN_MESSAGE = "Debes utilizar un correo corporativo del Grupo Montaigne"
export const EMAIL_LIMIT_MESSAGE = "Debes esperar 24h para poder abrir un parte nuevo"

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isAllowedRequesterEmail(value: string): boolean {
  const email = normalizeEmail(value)
  if (!email || [...email].length > 254 || !EMAIL_RE.test(email)) return false
  if ((ALLOWED_EMAIL_EXCEPTIONS as readonly string[]).includes(email)) return true
  const domain = email.slice(email.lastIndexOf("@") + 1)
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)
}

export function isUnlimitedRequesterEmail(value: string): boolean {
  return (UNLIMITED_REQUESTER_EMAILS as readonly string[]).includes(normalizeEmail(value))
}

export function isRaisedRequesterEmail(value: string): boolean {
  return (RAISED_REQUESTER_EMAILS as readonly string[]).includes(normalizeEmail(value))
}

/** Tope de partes / 24 h para ese email. `null` = sin tope. */
export function requesterEmailTicketLimit(value: string): number | null {
  if (isUnlimitedRequesterEmail(value)) return null
  if (isRaisedRequesterEmail(value)) return RAISED_REQUESTER_LIMIT
  return DEFAULT_REQUESTER_LIMIT
}

export function requesterEmailFieldError(value: string): string | null {
  if (!normalizeEmail(value)) return "Escribe tu email: te avisaremos cuando esté solucionado."
  if (!isAllowedRequesterEmail(value)) return EMAIL_DOMAIN_MESSAGE
  return null
}
