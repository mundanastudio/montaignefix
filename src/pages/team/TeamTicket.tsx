import { useEffect, useRef, useState, type FormEvent } from "react"
import { useOutletContext, useParams } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Textarea } from "../../components/ui/Field"
import { Spinner } from "../../components/ui/Spinner"
import { Materials } from "../../components/Materials"
import { TicketPhotos, type TicketPhoto } from "../../components/TicketPhotos"
import { eventLine, formatWhen, priorityLabel, statusLabel } from "../../domain/labels"
import { LIMITS } from "../../domain/ticketRules"
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
  status: string
  priority: string | null
  assignee: string | null
  assigneeId: string | null
  mine: boolean
  rejectionReason: string | null
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
  const { call, upload } = useOutletContext<TeamContextValue>()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [actorId, setActorId] = useState("")
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [photos, setPhotos] = useState<TicketPhoto[]>([])
  const [note, setNote] = useState("")
  const [colleague, setColleague] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<"resuelto" | "soltar" | "reasignar" | null>(null)
  const codeRef = useRef(code)
  const loadSeq = useRef(0)
  codeRef.current = code

  async function load() {
    const seq = ++loadSeq.current
    const requested = codeRef.current
    const result = await call<{
      actorId: string
      technicians: Technician[]
      ticket: Ticket
      notes: Note[]
      events: HistoryEvent[]
      materials: Material[]
      photos: TicketPhoto[]
    }>("staff-ticket", { code: requested })
    if (seq !== loadSeq.current || requested !== codeRef.current) return
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
    setPhotos(result.photos ?? [])
  }

  useEffect(() => {
    setLoading(true)
    setTicket(null)
    setColleague("")
    setNote("")
    setPhotos([])
    setError(null)
    setNotice(null)
    setDialog(null)
    setBusy(false)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, code])

  function viewedTicket(): Ticket | null {
    if (!ticket || ticket.code !== code) return null
    return ticket
  }

  async function run(name: string, body: Record<string, unknown>, okMessage: string) {
    const viewed = viewedTicket()
    if (!viewed) return false
    const ticketId = viewed.id
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await call(name, { ticketId, ...body })
    if (viewed.code !== codeRef.current) return false
    if (!result.ok) {
      setBusy(false)
      if (!result.expired) setError(result.message)
      if (result.message.includes("Recarga la ficha")) await load()
      return false
    }
    await load()
    if (viewed.code !== codeRef.current) return false
    setBusy(false)
    setNotice(okMessage)
    setDialog(null)
    return true
  }

  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (await run("staff-add-note", { body: note }, "Observación guardada.")) setNote("")
  }

  if (loading || (ticket !== null && ticket.code !== code)) {
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
        <TicketPhotos
          code={ticket.code}
          photos={photos}
          busy={busy}
          remaining={Math.max(0, LIMITS.photoTicketMax - photos.length)}
          canDelete={(photo) => photo.uploadedById === actorId}
          onAdd={async (blobs) => {
            const viewed = viewedTicket()
            if (!viewed) return false
            const body = new FormData()
            body.set("ticketId", viewed.id)
            blobs.forEach((blob, index) => body.append("photo", blob, `foto-${index + 1}.jpg`))
            setBusy(true)
            setError(null)
            const result = await upload("staff-add-photos", body)
            if (viewed.code !== codeRef.current) return false
            if (!result.ok) {
              setBusy(false)
              if (!result.expired) setError(result.message)
              return false
            }
            await load()
            setBusy(false)
            setNotice("Foto añadida.")
            return true
          }}
          onDelete={async (id) => {
            const ok = await run("staff-delete-photo", { photoId: id }, "Foto borrada.")
            return ok
          }}
        />
        {ticket.status === "rechazado" && ticket.rejectionReason && (
          <div>
            <h3>Motivo del rechazo</h3>
            <p className={styles.pre}>{ticket.rejectionReason}</p>
          </div>
        )}
      </section>

      <Materials
        key={code}
        items={materials}
        busy={busy}
        canMutate={!terminal}
        canPurchase={false}
        onAdd={(text) => run("staff-add-materials", { text }, "Materiales enviados.")}
        onEdit={(id, description) => run("staff-edit-material", { id, description }, "Artículo actualizado.")}
        onDelete={(id) => run("staff-delete-material", { id }, "Artículo borrado.")}
      />
      {!terminal && ticket.status !== "en_espera" && (
        <p className={styles.hint}>Si no puedes seguir sin el material, pásala a En espera. No se cambia sola.</p>
      )}

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
            <select className={styles.control} value={colleague} disabled={busy} onChange={(event) => setColleague(event.target.value)}>
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
    </div>
  )
}
