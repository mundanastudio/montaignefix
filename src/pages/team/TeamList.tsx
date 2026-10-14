import { useEffect, useState } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { PriorityBadge } from "../../components/ui/Badge"
import { TicketStatusChips } from "../../components/TicketStatusChips"
import { TicketListFields } from "../../components/TicketListFields"
import { Spinner } from "../../components/ui/Spinner"
import { formatWhen, priorityLabel } from "../../domain/labels"
import type { TeamContextValue } from "./TeamShell"
import styles from "./Team.module.css"

interface Tabs {
  mias: number
  sinAsignar: number
  todas: number
}

interface MaterialRow {
  description: string
  status: "pendiente" | "comprado"
}

interface TicketRow {
  id: string
  code: string
  description: string
  notes: string | null
  location: string
  status: string
  priority: string | null
  assignee: string | null
  mine: boolean
  createdAt: string
  materials: MaterialRow[]
}

const VIEWS = [
  ["mias", "Mis tareas"],
  ["sin", "Sin asignar"],
  ["todas", "Todas"],
] as const

export function TeamList() {
  const { person, call } = useOutletContext<TeamContextValue>()
  const [params] = useSearchParams()
  const vista = params.get("vista")
  const tab = vista === "sin" || vista === "todas" ? vista : "mias"
  const apiTab = tab === "sin" ? "sin_asignar" : tab
  const [tabs, setTabs] = useState<Tabs | null>(null)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setTickets([])
    void call<{ tabs: Tabs; tickets: TicketRow[] }>("staff-tickets", { tab: apiTab }).then((result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) {
        if (!result.expired) setError(result.message)
        return
      }
      setError(null)
      setTabs(result.tabs)
      setTickets(result.tickets)
    })
    return () => {
      active = false
    }
  }, [call, apiTab, person.slug])

  const count = (key: (typeof VIEWS)[number][0]) => {
    if (!tabs) return ""
    const n = key === "sin" ? tabs.sinAsignar : key === "todas" ? tabs.todas : tabs.mias
    return ` (${n})`
  }

  return (
    <div className={styles.stack}>
      <nav className={styles.tabs} aria-label="Tareas">
        {VIEWS.map(([value, label]) => (
          <Link
            key={value}
            to={value === "mias" ? "/equipo" : `/equipo?vista=${value}`}
            className={tab === value ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            aria-current={tab === value ? "page" : undefined}
          >
            {label}
            {count(value)}
          </Link>
        ))}
      </nav>
      <p className={styles.hint}>
        Por prioridad y, dentro de cada una, de la más antigua a la más nueva.
        {tab === "todas" ? " Tus cerradas van al final." : ""}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {loading && (
        <p className={styles.muted}>
          <Spinner label="Cargando tareas" /> Cargando tareas…
        </p>
      )}
      {!loading && tickets.length === 0 && (
        <Alert>
          {tab === "mias" && (
            <>
              No tienes tareas asignadas. Puedes asignarte una pulsando{" "}
              <Link className={styles.emptyLink} to="/equipo?vista=sin">
                <strong>aquí</strong>
              </Link>
            </>
          )}
          {tab === "sin" && "No hay incidencias sin asignar."}
          {tab === "todas" && "No hay incidencias abiertas ni cerradas."}
        </Alert>
      )}
      <div className={styles.cards}>
        {tickets.map((ticket) => {
          const priority = priorityLabel(ticket.priority)
          return (
            <Link key={ticket.id} className={styles.card} to={{ pathname: `/equipo/${ticket.code}`, search: params.toString() }}>
              <div className={styles.badges}>
                <span className={styles.code}>{ticket.code}</span>
                <TicketStatusChips status={ticket.status} assignee={ticket.assignee} />
                {priority ? <PriorityBadge priority={priority} /> : <span className={styles.muted}>Sin prioridad</span>}
                <span className={styles.noteWhen}>{formatWhen(ticket.createdAt)}</span>
              </div>
              <TicketListFields
                description={ticket.description}
                notes={ticket.notes}
                location={ticket.location}
                materials={ticket.materials}
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
