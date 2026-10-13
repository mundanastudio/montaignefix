import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { PriorityBadge, StatusBadge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Textarea } from "../../components/ui/Field"
import { Spinner } from "../../components/ui/Spinner"
import { eventLine, formatWhen, priorityLabel, statusLabel } from "../../domain/labels"
import { REASON_MAX, REJECT_PRESETS, reasonReady, trimmedReason } from "../../domain/rejectReason"
import type { AdminContextValue } from "./AdminShell"
import { Materials } from "../../components/Materials"
import { TicketPhotos, type TicketPhoto } from "../../components/TicketPhotos"
import { LIMITS } from "../../domain/ticketRules"
import { Confirm } from "./Confirm"
import styles from "./Admin.module.css"

interface Technician {
  id: string
  name: string
  combo?: boolean
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
  requesterEmail: string
  description: string
  location: string
  requesterNotes: string | null
  status: string
  priority: string | null
  assignee: string | null
  assigneeId: string | null
  duplicateOf: string | null
  rejectionReason: string | null
  createdAt: string
  assignedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
}

interface LinkedTicket {
  code: string
  description: string
  location: string
}

const FLOW = [
  ["en_curso", "En curso"],
  ["en_espera", "En espera"],
  ["resuelto", "Resuelto"],
] as const

const TERMINAL = new Set(["cerrado", "rechazado", "duplicado"])

export function TicketDetail() {
  const navigate = useNavigate()
  const { code = "" } = useParams()
  const [params] = useSearchParams()
  const { call, upload } = useOutletContext<AdminContextValue>()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [photos, setPhotos] = useState<TicketPhoto[]>([])
  const [linkedDuplicates, setLinkedDuplicates] = useState<LinkedTicket[]>([])
  const [openTickets, setOpenTickets] = useState<LinkedTicket[]>([])
  const [assignee, setAssignee] = useState("")
  const [note, setNote] = useState("")
  const [duplicateCode, setDuplicateCode] = useState("")
  const [duplicateQuery, setDuplicateQuery] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<"cerrar" | "reabrir" | "rechazar" | "duplicado" | "quitar" | "borrar" | null>(null)
  const codeRef = useRef(code)
  const loadSeq = useRef(0)
  codeRef.current = code

  async function load() {
    const seq = ++loadSeq.current
    const requested = codeRef.current
    const result = await call<{
      ticket: Ticket
      technicians: Technician[]
      notes: Note[]
      events: HistoryEvent[]
      materials: Material[]
      photos: TicketPhoto[]
      linkedDuplicates?: LinkedTicket[]
      openTickets?: LinkedTicket[]
    }>("admin-ticket", { code: requested })
    if (seq !== loadSeq.current || requested !== codeRef.current) return
    setLoading(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      setTicket(null)
      return
    }
    setError(null)
    setTicket(result.ticket)
    setTechnicians(result.technicians)
    setNotes(result.notes)
    setEvents(result.events)
    setMaterials(result.materials)
    setPhotos(result.photos ?? [])
    setLinkedDuplicates(result.linkedDuplicates ?? [])
    setOpenTickets(result.openTickets ?? [])
    setAssignee(result.ticket.assigneeId ?? "")
  }

  useEffect(() => {
    setLoading(true)
    setTicket(null)
    setAssignee("")
    setNote("")
    setDuplicateCode("")
    setDuplicateQuery("")
    setRejectReason("")
    setLinkedDuplicates([])
    setOpenTickets([])
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
    if (name === "admin-set-status" && body.status === "rechazado" && dialog !== "rechazar") {
      if (typeof body.reason === "string" && body.reason.trim()) setRejectReason(trimmedReason(body.reason))
      setDialog("rechazar")
      return false
    }
    if (name === "admin-set-status" && body.status === "duplicado" && dialog !== "duplicado") {
      if (typeof body.duplicateCode === "string" && body.duplicateCode.trim()) {
        setDuplicateCode(body.duplicateCode.trim().toUpperCase())
      }
      setDialog("duplicado")
      return false
    }
    const ticketId = viewed.id
    const payload =
      name === "admin-set-status" && body.status === "rechazado"
        ? { ...body, reason: trimmedReason(typeof body.reason === "string" ? body.reason : rejectReason) }
        : body
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await call<{ emailError?: string | null }>(name, { ticketId, ...payload })
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
    setNotice(result.emailError ? `${okMessage} El email al solicitante no ha salido.` : okMessage)
    setDialog(null)
    if (name === "admin-set-status" && payload.status === "rechazado") setRejectReason("")
    if (name === "admin-set-status" && payload.status === "duplicado") {
      setDuplicateCode("")
      setDuplicateQuery("")
    }
    return true
  }

  async function removeTicket() {
    const viewed = viewedTicket()
    if (!viewed) return
    setBusy(true)
    setError(null)
    const result = await call("admin-delete-ticket", { ticketId: viewed.id })
    setBusy(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      return
    }
    navigate("/gestion")
  }

  async function addNote(event: FormEvent) {
    event.preventDefault()
    const saved = await run("admin-add-note", { body: note }, "Observación guardada.")
    if (saved) setNote("")
  }


  if (loading || (ticket !== null && ticket.code !== code)) {
    return (
      <p className={styles.muted}>
        <Spinner label="Cargando la incidencia" /> Cargando la incidencia…
      </p>
    )
  }

  if (!ticket) {
    return (
      <div className={styles.stack}>
        <Link className={styles.back} to={{ pathname: "/gestion", search: params.toString() }}>
          Volver al listado
        </Link>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    )
  }

  const priority = priorityLabel(ticket.priority)
  const terminal = TERMINAL.has(ticket.status)
  const gestion = notes.filter((item) => item.kind === "gestion")
  const internas = notes.filter((item) => item.kind === "interna")
  const back = { pathname: "/gestion", search: params.toString() }
  const query = duplicateQuery.trim().toLowerCase()
  const choices = openTickets.filter((item) => {
    if (!query) return true
    return `${item.code} ${item.description} ${item.location}`.toLowerCase().includes(query)
  })

  return (
    <div className={styles.stack}>
      <Link className={styles.back} to={back}>
        Volver al listado
      </Link>
      <header>
        <div className={styles.badges}>
          <h2>{ticket.code}</h2>
          <StatusBadge status={statusLabel(ticket.status)} />
          {priority ? <PriorityBadge priority={priority} showLabel /> : <span className={styles.muted}>Sin prioridad</span>}
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
          canDelete={() => true}
          onAdd={async (blobs) => {
            const viewed = viewedTicket()
            if (!viewed) return false
            const body = new FormData()
            body.set("ticketId", viewed.id)
            blobs.forEach((blob, index) => body.append("photo", blob, `foto-${index + 1}.jpg`))
            setBusy(true)
            setError(null)
            const result = await upload("admin-add-photos", body)
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
            const ok = await run("admin-delete-photo", { photoId: id }, "Foto borrada.")
            return ok
          }}
        />
        <p>
          {ticket.requesterName} · <a href={`mailto:${ticket.requesterEmail}`}>{ticket.requesterEmail}</a>
        </p>
        <p className={styles.muted}>
          Abierta {formatWhen(ticket.createdAt)}
          {ticket.assignedAt ? ` · Asignada ${formatWhen(ticket.assignedAt)}` : ""}
          {ticket.resolvedAt ? ` · Resuelta ${formatWhen(ticket.resolvedAt)}` : ""}
          {ticket.closedAt ? ` · Cerrada ${formatWhen(ticket.closedAt)}` : ""}
        </p>
        {ticket.duplicateOf && (
          <p>
            Unido al parte <Link to={`/gestion/${ticket.duplicateOf}`}>{ticket.duplicateOf}</Link>
          </p>
        )}
        {linkedDuplicates.length > 0 && (
          <div>
            <h3>Avisos unidos</h3>
            <ul className={styles.pickList}>
              {linkedDuplicates.map((item) => (
                <li key={item.code}>
                  <Link to={`/gestion/${item.code}`}>
                    {item.code} · {item.description} · {item.location}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
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
        canMutate
        canPurchase
        onAdd={(text) => run("admin-add-materials", { text }, "Materiales añadidos a la lista.")}
        onEdit={(id, description) => run("admin-edit-material", { id, description }, "Artículo actualizado.")}
        onDelete={(id) => run("admin-delete-material", { id }, "Artículo borrado.")}
        onBuy={(id) => run("admin-mark-purchased", { ids: [id] }, "1 artículo marcado como comprado.")}
        onUnmark={(id) => run("admin-unmark-purchased", { id }, "El artículo vuelve a estar pendiente.")}
      />

      <section className={styles.block}>
        <h3>Prioridad</h3>
        <div className={styles.actions}>
          {([["p1", "P1"], ["p2", "P2"], ["p3", "P3"]] as const).map(([value, label]) => (
            <Button
              key={value}
              variant={ticket.priority === value ? "primary" : "secondary"}
              aria-pressed={ticket.priority === value}
              disabled={busy || ticket.priority === value}
              onClick={() => void run("admin-set-priority", { priority: value }, `Prioridad ${label}.`)}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className={styles.hint}>P1 hoy, si es urgente o de seguridad. P2 esta semana. P3 cuando se pueda.</p>
      </section>

      <section className={styles.block}>
        <h3>Estado</h3>
        <div className={styles.actions}>
          {!terminal &&
            FLOW.map(([value, label]) => (
              <Button
                key={value}
                variant={ticket.status === value ? "primary" : "secondary"}
                aria-pressed={ticket.status === value}
                disabled={busy || ticket.status === value}
                onClick={() => void run("admin-set-status", { status: value }, `Estado: ${label}.`)}
              >
                {label}
              </Button>
            ))}
          {!terminal && (
            <Button variant="primary" disabled={busy} onClick={() => setDialog("cerrar")}>
              Cerrar
            </Button>
          )}
          {ticket.status !== "rechazado" && ticket.status !== "duplicado" && (
            <Button variant="danger" disabled={busy} onClick={() => setDialog("rechazar")}>
              Rechazar
            </Button>
          )}
          {!terminal && (
            <Button variant="secondary" disabled={busy} onClick={() => setDialog("duplicado")}>
              Marcar como duplicado
            </Button>
          )}
          <Button variant="danger" disabled={busy} onClick={() => setDialog("borrar")}>
            Borrar incidencia
          </Button>
        </div>
        {ticket.status === "duplicado" && (
          <div className={styles.actions}>
            <Button variant="primary" disabled={busy} onClick={() => setDialog("quitar")}>
              Quitar duplicado
            </Button>
          </div>
        )}
        {(ticket.status === "cerrado" || ticket.status === "rechazado") && (
          <div className={styles.actions}>
            <Button variant="primary" disabled={busy} onClick={() => setDialog("reabrir")}>
              Reabrir
            </Button>
          </div>
        )}
        {ticket.status === "duplicado" && (
          <p className={styles.hint}>Si se marcó por error, quita el duplicado y el parte vuelve a como estaba.</p>
        )}
        {(ticket.status === "cerrado" || ticket.status === "rechazado") && (
          <p className={styles.hint}>Para seguir con ella, primero hay que reabrirla.</p>
        )}
      </section>

      <section className={styles.block}>
        <h3>Asignar</h3>
        <p className={styles.muted}>Ahora: {ticket.assignee ?? "sin asignar"}.</p>
        <div className={styles.rowActions}>
          <label className={styles.filter}>
            Técnico
            <select className={styles.control} value={assignee} disabled={busy} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Sin asignar</option>
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
          <Button
            disabled={busy || assignee === (ticket.assigneeId ?? "")}
            onClick={() => void run("admin-assign", { staffId: assignee }, assignee ? "Asignación guardada." : "Incidencia sin asignar.")}
          >
            Guardar asignación
          </Button>
        </div>
      </section>

      <div className={styles.noteCols}>
        <section className={styles.block}>
          <h3>Observaciones internas</h3>
          <p className={styles.hint}>Las escribe el equipo en sus tareas. Desde gestión solo se leen.</p>
          <Notes notes={internas} empty="Todavía no hay observaciones internas." />
        </section>
        <section className={styles.block}>
          <h3>Observaciones de gestión</h3>
          <Notes notes={gestion} empty="Todavía no hay observaciones de gestión." />
          <form className={styles.stack} onSubmit={(event) => void addNote(event)}>
            <Textarea label="Nueva observación de gestión" required value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
            <Button type="submit" disabled={busy || note.trim() === ""}>
              Añadir observación
            </Button>
          </form>
        </section>
      </div>

      <section className={styles.block}>
        <h3>Historial</h3>
        <ol className={styles.timeline}>
          {events.map((item) => (
            <li key={item.id}>
              <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
              <p>
                <strong>{item.actor}.</strong> {eventLine(item)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Confirm
        open={dialog === "cerrar"}
        title="Cerrar incidencia"
        acceptLabel="Cerrar"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("admin-set-status", { status: "cerrado" }, "Incidencia cerrada.")}
      >
        <p>
          Vas a cerrar {ticket.code}. El solicitante recibirá el aviso de que está solucionado.
          {linkedDuplicates.length > 0
            ? " Los avisos unidos también quedan cerrados."
            : ""}
        </p>
      </Confirm>
      <Confirm
        open={dialog === "reabrir"}
        title="Reabrir incidencia"
        acceptLabel="Reabrir"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("admin-set-status", { status: "reabrir" }, "Incidencia reabierta.")}
      >
        <p>Vas a reabrir {ticket.code}. Volverá a Asignado si tiene técnico, o a Nuevo si no.</p>
      </Confirm>
      <Confirm
        open={dialog === "rechazar"}
        title="Rechazar incidencia"
        acceptLabel="Rechazar"
        danger
        busy={busy}
        acceptDisabled={!reasonReady(rejectReason)}
        onCancel={() => setDialog(null)}
        onAccept={() =>
          void run("admin-set-status", { status: "rechazado", reason: trimmedReason(rejectReason) }, "Incidencia rechazada.")
        }
      >
        <p>
          Vas a rechazar {ticket.code}. Dejará de estar en el trabajo del equipo. La persona que abrió el parte recibirá este motivo por email.
          {linkedDuplicates.length > 0
            ? " También lo recibirán quienes abrieron los avisos unidos."
            : ""}
        </p>
        <div className={styles.chips}>
          {REJECT_PRESETS.map((preset) => (
            <Button key={preset} type="button" variant="secondary" disabled={busy} onClick={() => setRejectReason(preset)}>
              {preset}
            </Button>
          ))}
        </div>
        <Textarea
          label="Motivo (lo recibirá la persona que abrió el parte)"
          required
          value={rejectReason}
          rows={5}
          hint="Escribe en tono amable: este texto le llegará tal cual por email."
          onChange={(event) => setRejectReason(event.target.value)}
        />
        <p className={styles.hint}>
          {trimmedReason(rejectReason).length} / {REASON_MAX}
        </p>
      </Confirm>
      <Confirm
        open={dialog === "borrar"}
        title="Borrar incidencia"
        acceptLabel="Borrar incidencia"
        danger
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void removeTicket()}
      >
        <p>
          Vas a borrar {ticket.code}. Se eliminan las fotos, las notas, los materiales, el historial y los correos de este parte. No se puede deshacer. El código no se volverá a usar.
        </p>
      </Confirm>
      <Confirm
        open={dialog === "duplicado"}
        title="Marcar como duplicado"
        acceptLabel="Unir"
        busy={busy}
        acceptDisabled={duplicateCode.trim() === ""}
        onCancel={() => {
          setDialog(null)
          setDuplicateCode("")
          setDuplicateQuery("")
        }}
        onAccept={() =>
          void run(
            "admin-set-status",
            { status: "duplicado", duplicateCode },
            `Unido al parte ${duplicateCode.trim().toUpperCase()}.`,
          )
        }
      >
        <p>Elige el parte abierto al que se une {ticket.code}. Es obligatorio.</p>
        <label className={styles.filter}>
          Buscar
          <input
            className={styles.control}
            value={duplicateQuery}
            placeholder="Código, reparación o lugar"
            onChange={(event) => setDuplicateQuery(event.target.value)}
          />
        </label>
        {choices.length === 0 ? (
          <p className={styles.muted}>No hay partes abiertos a los que unirlo.</p>
        ) : (
          <ul className={styles.pickList}>
            {choices.map((item) => (
              <li key={item.code}>
                <Button
                  type="button"
                  variant={duplicateCode === item.code ? "primary" : "secondary"}
                  aria-pressed={duplicateCode === item.code}
                  className={styles.pickItem}
                  onClick={() => setDuplicateCode(item.code)}
                >
                  <span>
                    {item.code} · {item.description}
                  </span>
                  <span className={styles.pickMeta}>{item.location}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Confirm>
      <Confirm
        open={dialog === "quitar"}
        title="Quitar duplicado"
        acceptLabel="Quitar duplicado"
        busy={busy}
        onCancel={() => setDialog(null)}
        onAccept={() => void run("admin-set-status", { status: "quitar_duplicado" }, "Ya no está unido a otro parte.")}
      >
        <p>
          Vas a quitar el duplicado de {ticket.code}. Volverá al estado que tenía antes. El historial se queda. Si ya salió el email al solicitante, no se puede retirar.
        </p>
      </Confirm>
    </div>
  )
}

function Notes({ notes, empty }: { notes: Note[]; empty: string }) {
  if (notes.length === 0) return <p className={styles.muted}>{empty}</p>
  return (
    <div className={styles.stack}>
      {notes.map((item) => (
        <p key={item.id} className={styles.noteLine}>
          <span>{item.body}</span>
          <span className={styles.noteWhen}>• {formatWhen(item.createdAt)}</span>
        </p>
      ))}
    </div>
  )
}
