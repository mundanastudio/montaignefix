import { useEffect, useState, type FormEvent } from "react"
import { useOutletContext, useParams } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input, Textarea } from "../../components/ui/Field"
import { Spinner } from "../../components/ui/Spinner"
import { eventLine, formatWhen, priorityLabel, statusLabel } from "../../domain/labels"
import { Confirm } from "../admin/Confirm"
import type { TeamContextValue } from "./TeamShell"
import styles from "./Team.module.css"

interface Technician {
  id: string
  name: string
}

interface Note {
  id: number
  kind: "gestion" | "interna"
  body: string
  author: string
  createdAt: string
}

interface HistoryEvent {
  id: number
  type: string
  actor: string
  old: string | null
  new: string | null
  createdAt: string
}

interface Material {
  id: string
  description: string
  status: "pendiente" | "comprado"
  requestedBy: string
  requestedById: string
  createdAt: string
  purchasedBy: string | null
  purchasedAt: string | null
}

interface Ticket {
  id: string
  code: string
  requesterName: string
  description: string
  location: string
  requesterNotes: string | null
  photoUrl: string | null
  photoError?: boolean
  status: string
  priority: string | null
  assignee: string | null
  assigneeId: string | null
  mine: boolean
  resolvedAt: string | null
  createdAt: string
}

const FLOW = [
  ["en_curso", "En curso"],
  ["en_espera", "En espera"],
] as const

const TERMINAL = new Set(["cerrado", "rechazado", "duplicado"])

export function TeamTicket() {
  const { code = "" } = useParams()
  const { call } = useOutletContext<TeamContextValue>()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [actorId, setActorId] = useState("")
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [note, setNote] = useState("")
  const [materialsText, setMaterialsText] = useState("")
  const [colleague, setColleague] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<"resuelto" | "soltar" | "reasignar" | null>(null)
  const [remove, setRemove] = useState<Material | null>(null)
  const [edit, setEdit] = useState<Material | null>(null)
  const [editText, setEditText] = useState("")

  async function load() {
    const result = await call<{
      actorId: string
      technicians: Technician[]
      ticket: Ticket
      notes: Note[]
      events: HistoryEvent[]
      materials: Material[]
    }>("staff-ticket", { code })
    setLoading(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      setTicket(null)
      return
    }
    setError(null)
    setActorId(result.actorId)
    setTechnicians(result.technicians)
    setTicket(result.ticket)
    setNotes(result.notes)
    setEvents(result.events)
    setMaterials(result.materials)
  }

  useEffect(() => {
    setLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, code])

  async function run(name: string, body: Record<string, unknown>, okMessage: string) {
    if (!ticket) return false
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await call(name, { ticketId: ticket.id, ...body })
    if (!result.ok) {
      setBusy(false)
      if (!result.expired) setError(result.message)
      return false
    }
    await load()
    setBusy(false)
    setNotice(okMessage)
    setDialog(null)
    setRemove(null)
    return true
  }

  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (await run("staff-add-note", { body: note }, "Observación guardada.")) setNote("")
  }

  async function addMaterials(event: FormEvent) {
    event.preventDefault()
    if (await run("staff-add-materials", { text: materialsText }, "Materiales enviados.")) setMaterialsText("")
  }

  if (loading) {
    return (
      <p className={styles.muted}>
        <Spinner label="Cargando la incidencia" /> Cargando la incidencia…
      </p>
    )
  }

  if (!ticket) {
    return <div className={styles.stack}>{error && <Alert tone="error">{error}</Alert>}</div>
  }

  const priority = priorityLabel(ticket.priority)
  const terminal = TERMINAL.has(ticket.status)
  const internas = notes.filter((item) => item.kind === "interna")
  const gestion = notes.filter((item) => item.kind === "gestion")
  const others = technicians.filter((item) => item.id !== actorId)
  const colleagueName = others.find((item) => item.id === colleague)?.name

  return (
    <div className={styles.stack}>
      <header>
        <div className={styles.badges}>
          <h2>{ticket.code}</h2>
          <StatusBadge status={statusLabel(ticket.status)} />
          <span className={styles.beside}>
            {priority ? <PriorityBadge priority={priority} showLabel /> : null}
            <span className={styles.opened}>
              Abierta {formatWhen(ticket.createdAt)}
              {ticket.resolvedAt ? ` · Resuelta ${formatWhen(ticket.resolvedAt)}` : ""}
              {" · "}
              {ticket.assignee ?? "Sin asignar"}
            </span>
          </span>
        </div>
      </header>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className={styles.block}>
        <p>
          <strong>Lugar: </strong>
          {ticket.location}
        </p>
        <p className={styles.pre}>
          <strong>Reparación necesaria: </strong>
          {ticket.description}
        </p>
        <p className={styles.sameLine}>
          <strong>Solicitante: </strong>
          {ticket.requesterName}
        </p>
        <p className={styles.sameLine}>
          <strong>Observaciones del solicitante: </strong>
          {ticket.requesterNotes?.replace(/\s+/g, " ").trim() || "Sin observaciones"}
        </p>
        {ticket.photoUrl ? (
          <img className={styles.photo} src={ticket.photoUrl} alt={`Foto del desperfecto de ${ticket.code}`} />
        ) : (
          <p className={styles.muted}>{ticket.photoError ? "No se ha podido cargar la foto." : "Sin foto."}</p>
        )}
      </section>

      {!ticket.mine && !ticket.assigneeId && !terminal && (
        <Button size="lg" fullWidth disabled={busy} onClick={() => void run("staff-assign", { mode: "tomar" }, "Te has asignado esta incidencia.")}>
          Asignármela
        </Button>
      )}
      {!ticket.mine && ticket.assigneeId && (
        <Alert>Solo puedes modificar las tareas que tienes asignadas. Esta la tiene {ticket.assignee}.</Alert>
      )}

      {ticket.mine && !terminal && (
        <section className={styles.block}>
          <h3>Estado</h3>
          <div className={styles.actions}>
            {FLOW.map(([value, label]) => (
              <Button
                key={value}
                variant={ticket.status === value ? "primary" : "secondary"}
                aria-pressed={ticket.status === value}
                disabled={busy || ticket.status === value}
                onClick={() => void run("staff-set-status", { status: value }, `Estado: ${label}.`)}
              >
                {label}
              </Button>
            ))}
            <Button variant={ticket.status === "resuelto" ? "primary" : "secondary"} disabled={busy || ticket.status === "resuelto"} onClick={() => setDialog("resuelto")}>
              Resuelto
            </Button>
          </div>
        </section>
      )}

      {ticket.mine && (
        <section className={styles.block}>
          <h3>Asignación</h3>
          <div className={styles.actions}>
            <Button variant="secondary" disabled={busy} onClick={() => setDialog("soltar")}>
              Quitarme esta tarea
            </Button>
          </div>
          <label className={styles.stack}>
            Pasarla a un compañero
            <select className={styles.control} value={colleague} onChange={(event) => setColleague(event.target.value)}>
              <option value="">Elige</option>
              {others.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" disabled={busy || colleague === ""} onClick={() => setDialog("reasignar")}>
            Pasarla
          </Button>
        </section>
      )}

      <div className={styles.noteCols}>
        <section className={styles.block}>
          <h3>Observaciones internas</h3>
          {internas.length === 0 && <p className={styles.muted}>Todavía no hay observaciones internas.</p>}
          {internas.map((item) => (
            <p key={item.id} className={styles.noteLine}>
              <span>{item.body}</span>
              <span className={styles.noteWhen}>• {formatWhen(item.createdAt)}</span>
            </p>
          ))}
          {ticket.mine && (
            <form className={styles.stack} onSubmit={(event) => void addNote(event)}>
              <Textarea label="Tu observación interna" required value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
              <Button type="submit" disabled={busy || note.trim() === ""}>
                Añadir observación
              </Button>
            </form>
          )}
        </section>
        <section className={styles.block}>
          <h3>Observaciones de gestión</h3>
          {gestion.length === 0 && <p className={styles.muted}>Todavía no hay observaciones de gestión.</p>}
          {gestion.map((item) => (
            <p key={item.id} className={styles.noteLine}>
              <span>{item.body}</span>
              <span className={styles.noteWhen}>• {formatWhen(item.createdAt)}</span>
            </p>
          ))}
        </section>
      </div>

      <section className={styles.block}>
        <h3>Materiales</h3>
        {materials.length === 0 && <p className={styles.muted}>Todavía no hay materiales pedidos.</p>}
        {materials.map((item) => (
          <div key={item.id} className={styles.item}>
            <p className={styles.noteLine}>
              <span>{item.description}</span>
              <span className={styles.noteWhen}>•</span>
              <span className={item.status === "pendiente" ? styles.statePending : styles.stateBought}>
                {item.status === "pendiente" ? "Pendiente" : "Comprado"}
              </span>
              <span className={styles.noteWhen}>• {formatWhen(item.status === "pendiente" ? item.createdAt : item.purchasedAt)}</span>
            </p>
            {ticket.mine && item.status === "pendiente" && item.requestedById === actorId && (
              <div className={styles.itemActions}>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setEdit(item)
                    setEditText(item.description)
                  }}
                >
                  Editar
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => setRemove(item)}>
                  Borrar
                </Button>
              </div>
            )}
          </div>
        ))}
        {ticket.mine && (
          <form className={styles.stack} onSubmit={(event) => void addMaterials(event)}>
            <Textarea
              label="Materiales que hay que comprar"
              required
              hint="Un artículo por línea."
              value={materialsText}
              onChange={(event) => setMaterialsText(event.target.value)}
            />
            {ticket.status !== "en_espera" && (
              <p className={styles.hint}>Si no puedes seguir sin el material, pásala a En espera. No se cambia sola.</p>
            )}
            <Button type="submit" disabled={busy || materialsText.trim() === ""}>
              Enviar
            </Button>
          </form>
        )}
      </section>

      <section className={styles.block}>
        <h3>Historial</h3>
        <ol className={styles.timeline}>
          {events.map((item) => (
            <li key={item.id}>
              <p className={styles.muted}>{formatWhen(item.createdAt)}</p>
              <p>
                <strong>{item.actor}.</strong> {eventLine(item)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Confirm
        open={dialog === "resuelto"}
        title="Marcar como resuelta"
        acceptLabel="Aceptar"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("staff-set-status", { status: "resuelto" }, "Marcada como resuelta.")}
      >
        <p>Vas a marcar {ticket.code} como resuelta. Se guardará la fecha de resolución.</p>
      </Confirm>
      <Confirm
        open={dialog === "soltar"}
        title="Quitarme esta tarea"
        acceptLabel="Quitármela"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("staff-assign", { mode: "soltar" }, "La incidencia vuelve a estar sin asignar.")}
      >
        <p>Vas a quitarte {ticket.code}. Otro compañero podrá asignársela.</p>
      </Confirm>
      <Confirm
        open={dialog === "reasignar"}
        title="Pasar la tarea"
        acceptLabel="Pasarla"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("staff-assign", { mode: "reasignar", staffId: colleague }, `Pasada a ${colleagueName ?? "tu compañero"}.`)}
      >
        <p>
          Vas a pasar {ticket.code} a {colleagueName}.
        </p>
      </Confirm>
      <Confirm
        open={edit !== null}
        title="Editar material"
        acceptLabel="Guardar"
        busy={busy}
        onCancel={() => setEdit(null)}
        onAccept={() => {
          if (editText.trim() === "") return
          void run("staff-edit-material", { id: edit?.id, description: editText }, "Artículo actualizado.").then((ok) => {
            if (ok) setEdit(null)
          })
        }}
      >
        <Input label="Texto" required maxLength={200} value={editText} onChange={(event) => setEditText(event.target.value)} />
      </Confirm>
      <Confirm
        open={remove !== null}
        title="Borrar material"
        acceptLabel="Borrar"
        danger
        busy={busy}
        onCancel={() => setRemove(null)}
        onAccept={() => void run("staff-delete-material", { id: remove?.id }, "Artículo borrado.")}
      >
        <p>Vas a borrar «{remove?.description}». Solo se puede si sigue pendiente y lo pediste tú.</p>
      </Confirm>
    </div>
  )
}
