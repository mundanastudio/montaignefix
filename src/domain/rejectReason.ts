export const REASON_MIN = 10
export const REASON_MAX = 500

export const REJECT_PRESETS = [
  "No es una reparación: es una compra de material o equipamiento nuevo. Para pedirlo, habla con Jefatura de Estudios.",
  "Lo hemos revisado y ya está solucionado o funciona correctamente.",
  "No depende del equipo de mantenimiento del colegio: lo gestiona otro servicio o una empresa externa.",
  "Nos falta información para localizarlo o entender qué ocurre. Abre un nuevo parte con más detalle o una foto.",
] as const

export function trimmedReason(value: string): string {
  return value.trim()
}

export function reasonReady(value: string): boolean {
  const text = trimmedReason(value)
  return text.length >= REASON_MIN && text.length <= REASON_MAX
}
