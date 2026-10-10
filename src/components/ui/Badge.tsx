import styles from "./Badge.module.css";

export const STATUSES = [
  "Nuevo",
  "Asignado",
  "En curso",
  "En espera",
  "Resuelto",
  "Cerrado",
  "Rechazado",
  "Duplicado",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = {
  P1: "Urgente",
  P2: "Importante",
  P3: "Cuando se pueda",
} as const;
export type Priority = keyof typeof PRIORITIES;

const statusKey = (s: Status) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

export function StatusBadge({ status }: { status: Status }) {
  const key = statusKey(status);
  return (
    <span
      className={styles.badge}
      style={{
        background: `var(--status-${key}-bg)`,
        color: `var(--status-${key}-fg)`,
      }}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  const p = priority.toLowerCase();
  return (
    <span
      className={`${styles.badge} ${styles.priority}`}
      style={{ background: `var(--priority-${p}-bg)`, color: `var(--priority-${p}-fg)` }}
      title={PRIORITIES[priority]}
    >
      {priority}
      {showLabel && <span className={styles.label}> · {PRIORITIES[priority]}</span>}
    </span>
  );
}
