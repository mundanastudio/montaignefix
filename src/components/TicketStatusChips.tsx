import { StatusBadge } from "./ui/Badge"
import { statusLabel } from "../domain/labels"

export function TicketStatusChips({ status, assignee }: { status: string; assignee: string | null }) {
  const label = statusLabel(status)
  return (
    <>
      {status === "asignado" && assignee ? (
        <StatusBadge status={label} label={assignee} />
      ) : (
        <StatusBadge status={label} />
      )}
      {status !== "asignado" && assignee ? <StatusBadge status="Asignado" label={assignee} /> : null}
    </>
  )
}
