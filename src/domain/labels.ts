import type { Priority, Status } from "../components/ui/Badge"

export const STATUS_LABEL = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  en_curso: "En curso",
  en_espera: "En espera",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
  duplicado: "Duplicado",
} as const

export type DbStatus = keyof typeof STATUS_LABEL

export function statusLabel(status: string): Status {
  return STATUS_LABEL[status as DbStatus] ?? "Nuevo"
}

export function priorityLabel(priority: string | null): Priority | null {
  if (priority === "p1" || priority === "p2" || priority === "p3") {
    return priority.toUpperCase() as Priority
  }
  return null
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")}/${pick("month")}/${pick("year")} • ${pick("hour")}:${pick("minute")}`
}

function statusWord(value: string | null): string {
  if (!value) return "sin estado"
  return STATUS_LABEL[value as DbStatus] ?? value
}

function priorityWord(value: string | null): string {
  const label = priorityLabel(value)
  return label ?? "sin prioridad"
}

export function eventLine(event: { type: string; old: string | null; new: string | null }): string {
  switch (event.type) {
    case "creado":
      return "Abrió la incidencia"
    case "estado":
      return `Cambió el estado de ${statusWord(event.old)} a ${statusWord(event.new)}`
    case "prioridad":
      return `Cambió la prioridad de ${priorityWord(event.old)} a ${priorityWord(event.new)}`
    case "asignacion":
      return `Asignación: ${event.old ?? "nadie"} → ${event.new ?? "nadie"}`
    case "nota":
      return event.new === "interna" ? "Añadió una observación interna" : "Añadió una observación de gestión"
    case "material_solicitado":
      return `Pidió material: ${event.new ?? ""}`
    case "material_comprado":
      return `Marcó como comprado: ${event.new ?? ""}`
    case "material_repuesto":
      return `Volvió a dejar pendiente: ${event.old ?? ""}`
    case "material_borrado":
      return `Borró el material: ${event.old ?? ""}`
    case "material_editado":
      return `Cambió el material «${event.old ?? ""}» por «${event.new ?? ""}»`
    case "rechazo":
      return `Rechazó el parte: «${event.new ?? ""}»`
    case "foto_anadida":
      return "Añadió una foto"
    case "foto_borrada":
      return "Borró una foto"
    default:
      return "Registró un cambio"
  }
}
