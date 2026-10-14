import { useEffect, useState } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { PriorityBadge } from "../../components/ui/Badge"
import { TicketStatusChips } from "../../components/TicketStatusChips"
import { TicketListFields } from "../../components/TicketListFields"
import { Alert } from "../../components/ui/Alert"
import { Button } from "../../components/ui/Button"
import { Spinner } from "../../components/ui/Spinner"
import { formatWhen, priorityLabel } from "../../domain/labels"
import type { AdminContextValue } from "./AdminShell"
import styles from "./Admin.module.css"

interface Counts {
  nuevas: number
  p1Abiertas: number
  abiertas: number
  resueltas: number
  cerradas: number
}

interface Technician {
  id: string
  name: string
  combo?: boolean
}

interface EmailRow {
  id: number
  kind: string
  recipient: string
  subject: string
  ok: boolean
  error: string | null
  createdAt: string
}

interface MaterialRow {
  description: string
  status: "pendiente" | "comprado"
}

interface TicketRow {
  id: string
  code: string
  requesterName: string
  description: string
  notes: string | null
  location: string
  status: string
  priority: string | null
  assignee: string | null
  createdAt: string
  materials: MaterialRow[]
}

const SHOW_CORREOS = false

const VIEWS = [
  ["abiertas", "Abiertas"],
  ["resueltas", "Resueltas"],
  ["cerradas", "Cerradas"],
] as const

type View = (typeof VIEWS)[number][0]

function currentView(value: string | null): View {
  if (value === "resueltas" || value === "cerradas") return value
  return "abiertas"
}

function statusChip(ticket: TicketRow) {
  return <TicketStatusChips status={ticket.status} assignee={ticket.assignee} />
}

export function TicketList() {
  const { call } = useOutletContext<AdminContextValue>()
  const [params, setParams] = useSearchParams()
  const tab = currentView(params.get("vista"))
  const priority = params.get("prioridad") ?? ""
  const assigned = params.get("asignado") ?? ""
  const [counts, setCounts] = useState<Counts | null>(null)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [emails, setEmails] = useState<EmailRow[]>([])

  useEffect(() => {
    if (!SHOW_CORREOS) return
    let active = true
    void call<{ emails: EmailRow[] }>("admin-email-log").then((result) => {
      if (!active || !result.ok) return
      setEmails(result.emails ?? [])
    })
    return () => {
      active = false
    }
  }, [call])

  useEffect(() => {
    let active = true
    setLoading(true)
    void call<{ counts: Counts; technicians: Technician[]; tickets: TicketRow[] }>("admin-tickets", {
      tab,
      priority,
      assigned,
    }).then((result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) {
        if (!result.expired) setError(result.message)
        return
      }
      setError(null)
      setCounts(result.counts)
      setTechnicians(result.technicians)
      setTickets(result.tickets)
    })
    return () => {
      active = false
    }
  }, [call, tab, priority, assigned])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete("estado")
    next.delete("q")
    setParams(next)
  }

  function tabHref(view: View) {
    const next = new URLSearchParams(params)
    next.delete("estado")
    next.delete("q")
    if (view === "abiertas") next.delete("vista")
    else next.set("vista", view)
    const search = next.toString()
    return search ? `/gestion?${search}` : "/gestion"
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (tab !== "abiertas") next.set("vista", tab)
    setParams(next)
  }

  const filtered = Boolean(priority || assigned)
  const tabCount = (view: View) => {
    if (!counts) return ""
    const n = view === "abiertas" ? counts.abiertas : view === "resueltas" ? counts.resueltas : counts.cerradas
    return ` (${n})`
  }

  return (
    <div className={styles.stack}>
      {SHOW_CORREOS && (
      <section className={styles.block}>
        <h2>Correos</h2>
        {emails.length === 0 && <p className={styles.muted}>Todavía no se ha enviado ningún correo.</p>}
        {emails.map((item) => (
          <p key={item.id} className={item.ok ? styles.muted : styles.mailFail}>
            <strong>{mailKind(item.kind)}</strong>
            {" · "}
            {item.recipient || "sin destinatario"}
            {" · "}
            {formatWhen(item.createdAt)}
            {item.ok ? "" : ` · ${item.error ?? "No se ha podido enviar."}`}
          </p>
        ))}
      </section>
      )}

      <nav className={styles.viewTabs} aria-label="Incidencias">
        {VIEWS.map(([value, label]) => (
          <Link
            key={value}
            to={tabHref(value)}
            className={tab === value ? `${styles.viewTab} ${styles.viewTabOn}` : styles.viewTab}
            aria-current={tab === value ? "page" : undefined}
          >
            {label}
            {tabCount(value)}
          </Link>
        ))}
      </nav>

      <div className={styles.filters}>
        <label className={styles.filter}>
          Prioridad
          <select className={styles.control} value={priority} onChange={(event) => setFilter("prioridad", event.target.value)}>
            <option value="">Todas</option>
            <option value="p1">P1 · Urgente</option>
            <option value="p2">P2 · Importante</option>
            <option value="p3">P3 · Cuando se pueda</option>
            <option value="ninguna">Sin prioridad</option>
          </select>
        </label>
        <label className={styles.filter}>
          Asignado
          <select className={styles.control} value={assigned} onChange={(event) => setFilter("asignado", event.target.value)}>
            <option value="">Todos</option>
            <option value="ninguno">Sin asignar</option>
            <optgroup label="Persona">
              {technicians.filter((person) => !person.combo).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Equipo">
              {technicians.filter((person) => person.combo).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {filtered && (
          <div className={styles.filterActions}>
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        )}
      </div>

      <p className={styles.hint}>
        {tab === "abiertas"
          ? "Por prioridad y, dentro de cada una, las nuevas primero. Sin prioridad, de la más antigua a la más nueva."
          : "De la más reciente a la más antigua."}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {loading && (
        <p className={styles.muted}>
          <Spinner label="Cargando incidencias" /> Cargando incidencias…
        </p>
      )}
      {!loading && tickets.length === 0 && (
        <Alert>
          {filtered
            ? "No hay incidencias con esos filtros."
            : tab === "abiertas"
              ? "No hay incidencias abiertas."
              : tab === "resueltas"
                ? "No hay incidencias resueltas."
                : "No hay incidencias cerradas."}
        </Alert>
      )}

      {tickets.length > 0 && <div className={styles.cards}>
        {tickets.map((ticket) => (
          <Link key={ticket.id} className={styles.cardLink} to={{ pathname: `/gestion/${ticket.code}`, search: params.toString() }}>
            <TicketBody ticket={ticket} />
          </Link>
        ))}
      </div>}

      {tickets.length > 0 && <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Incidencias</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nombre</th>
              <th scope="col">Reparación</th>
              <th scope="col">Lugar</th>
              <th scope="col">Estado</th>
              <th scope="col">Prioridad</th>
              <th scope="col">Asignado</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const priority = priorityLabel(ticket.priority)
              return (
                <tr key={ticket.id}>
                  <td>
                    <Link className={styles.code} to={{ pathname: `/gestion/${ticket.code}`, search: params.toString() }}>
                      {ticket.code}
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.nameLink} to={{ pathname: `/gestion/${ticket.code}`, search: params.toString() }}>
                      {ticket.requesterName}
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.nameLink} to={{ pathname: `/gestion/${ticket.code}`, search: params.toString() }}>
                      {ticket.description}
                    </Link>
                  </td>
                  <td>{ticket.location}</td>
                  <td>{statusChip(ticket)}</td>
                  <td>{priority ? <PriorityBadge priority={priority} /> : "Sin prioridad"}</td>
                  <td>{ticket.assignee ? "—" : "Sin asignar"}</td>
                  <td>{formatWhen(ticket.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

function mailKind(kind: string): string {
  if (kind === "nuevo") return "Nuevo parte"
  if (kind === "recibido") return "Acuse"
  if (kind === "resuelto") return "Resuelto"
  if (kind === "cerrado") return "Cerrado"
  if (kind === "rechazado") return "Rechazado"
  if (kind === "prueba") return "Prueba"
  if (kind === "informe") return "Informe"
  return kind
}

function TicketBody({ ticket }: { ticket: TicketRow }) {
  const priority = priorityLabel(ticket.priority)
  return (
    <>
      <div className={styles.badges}>
        <span className={styles.code}>{ticket.code}</span>
        {statusChip(ticket)}
        {priority ? <PriorityBadge priority={priority} showLabel /> : <span className={styles.muted}>Sin prioridad</span>}
        <span className={styles.noteWhen}>{formatWhen(ticket.createdAt)}</span>
      </div>
      <TicketListFields
        description={ticket.description}
        notes={ticket.notes}
        location={ticket.location}
        materials={ticket.materials}
      />
    </>
  )
}
