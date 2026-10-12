import { useEffect, useState, type FormEvent } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge"
import { Alert } from "../../components/ui/Alert"
import { Button } from "../../components/ui/Button"
import { Spinner } from "../../components/ui/Spinner"
import { formatWhen, priorityLabel, statusLabel } from "../../domain/labels"
import type { AdminContextValue } from "./AdminShell"
import styles from "./Admin.module.css"

interface Counts {
  nuevas: number
  p1Abiertas: number
  resueltas: number
}

interface Technician {
  id: string
  name: string
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

interface TicketRow {
  id: string
  code: string
  requesterName: string
  description: string
  location: string
  status: string
  priority: string | null
  assignee: string | null
  createdAt: string
}

const SHOW_CORREOS = false

const STATUSES = [
  ["", "Todos"],
  ["nuevo", "Nuevo"],
  ["asignado", "Asignado"],
  ["en_curso", "En curso"],
  ["en_espera", "En espera"],
  ["resuelto", "Resuelto"],
  ["cerrado", "Cerrado"],
  ["rechazado", "Rechazado"],
  ["duplicado", "Duplicado"],
] as const

export function TicketList() {
  const { call } = useOutletContext<AdminContextValue>()
  const [params, setParams] = useSearchParams()
  const status = params.get("estado") ?? ""
  const priority = params.get("prioridad") ?? ""
  const assigned = params.get("asignado") ?? ""
  const query = params.get("q") ?? ""
  const [draft, setDraft] = useState(query)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [emails, setEmails] = useState<EmailRow[]>([])

  useEffect(() => setDraft(query), [query])

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
      status,
      priority,
      assigned,
      query,
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
  }, [call, status, priority, assigned, query])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  function search(event: FormEvent) {
    event.preventDefault()
    setFilter("q", draft.trim())
  }

  const filtered = Boolean(status || priority || assigned || query)

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

      <p className={styles.summary} aria-label="Indicadores">
        <span>
          <strong>{counts?.nuevas ?? "–"}</strong> <span className={styles.nuevas}>Nuevas</span>
        </span>
        <span aria-hidden="true">-</span>
        <span>
          <strong>{counts?.p1Abiertas ?? "–"}</strong> <span className={styles.p1}>P1</span>
        </span>
        <span aria-hidden="true">-</span>
        <span>
          <strong>{counts?.resueltas ?? "–"}</strong> <span className={styles.resueltas}>Resueltas</span>
        </span>
      </p>

      <form className={styles.filters} onSubmit={search}>
        <label className={styles.filter}>
          Estado
          <select className={styles.control} value={status} onChange={(event) => setFilter("estado", event.target.value)}>
            {STATUSES.map(([value, label]) => (
              <option key={value || "todos"} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
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
            {technicians.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.search}>
          <label className={styles.filter}>
            Buscar
            <input
              className={styles.control}
              type="search"
              value={draft}
              placeholder="Código, reparación, lugar o nombre"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <Button type="submit">Buscar</Button>
          {filtered && (
            <Button type="button" variant="ghost" onClick={() => setParams(new URLSearchParams())}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      <p className={styles.hint}>Por prioridad y, dentro de cada una, de la más antigua a la más nueva.</p>
      {error && <Alert tone="error">{error}</Alert>}
      {loading && (
        <p className={styles.muted}>
          <Spinner label="Cargando incidencias" /> Cargando incidencias…
        </p>
      )}
      {!loading && tickets.length === 0 && <Alert>No hay incidencias con esos filtros.</Alert>}

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
                  <td>
                    <StatusBadge status={statusLabel(ticket.status)} />
                  </td>
                  <td>{priority ? <PriorityBadge priority={priority} /> : "Sin prioridad"}</td>
                  <td>{ticket.assignee ?? "Sin asignar"}</td>
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
        <StatusBadge status={statusLabel(ticket.status)} />
        {priority ? <PriorityBadge priority={priority} showLabel /> : <span className={styles.muted}>Sin prioridad</span>}
      </div>
      <p className={styles.clamp}>{ticket.description}</p>
      <p className={styles.muted}>
        {ticket.location} · {ticket.assignee ?? "Sin asignar"} · {formatWhen(ticket.createdAt)}
      </p>
      <p className={styles.nameLink}>{ticket.requesterName}</p>
    </>
  )
}
