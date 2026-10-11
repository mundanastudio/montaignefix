import { useEffect, useRef, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { Button } from "../../components/ui/Button"
import { Spinner } from "../../components/ui/Spinner"
import { formatWhen } from "../../domain/labels"
import type { AdminContextValue } from "./AdminShell"
import { Confirm } from "./Confirm"
import styles from "./Admin.module.css"

interface PendingItem {
  id: string
  description: string
  requestedBy: string
  createdAt: string
  ticketId: string
  code: string
  repair: string
  location: string
}

interface RecentItem {
  id: string
  description: string
  requestedBy: string
  purchasedBy: string | null
  purchasedAt: string
  code: string
  repair: string
  location: string
}

interface Group {
  ticketId: string
  code: string
  repair: string
  location: string
  items: PendingItem[]
}

function groupItems(items: PendingItem[]): Group[] {
  const groups = new Map<string, Group>()
  for (const item of items) {
    const current = groups.get(item.ticketId) ?? {
      ticketId: item.ticketId,
      code: item.code,
      repair: item.repair,
      location: item.location,
      items: [],
    }
    current.items.push(item)
    groups.set(item.ticketId, current)
  }
  return [...groups.values()]
}

export function ShoppingList() {
  const { call } = useOutletContext<AdminContextValue>()
  const [view, setView] = useState<"pendiente" | "reciente">("pendiente")
  const [groups, setGroups] = useState<Group[]>([])
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmBuy, setConfirmBuy] = useState(false)
  const [undo, setUndo] = useState<RecentItem | null>(null)

  async function load() {
    const result = await call<{ pending: PendingItem[]; recent: RecentItem[] }>("admin-shopping-list")
    setLoading(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      return
    }
    setError(null)
    setGroups(groupItems(result.pending))
    setRecent(result.recent)
    setSelected((current) => {
      const alive = new Set(result.pending.map((item) => item.id))
      return new Set([...current].filter((id) => alive.has(id)))
    })
  }

  useEffect(() => {
    void load()
    // La carga inicial solo depende de la sesión, que ya vive en call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call])

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(group: Group) {
    const ids = group.items.map((item) => item.id)
    const all = ids.every((id) => selected.has(id))
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (all) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  async function markPurchased() {
    const ids = [...selected]
    setBusy(true)
    setError(null)
    const result = await call<{ changed?: number }>("admin-mark-purchased", { ids })
    setBusy(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      return
    }
    setConfirmBuy(false)
    setSelected(new Set())
    const changed = result.changed ?? 0
    setNotice(
      changed < ids.length
        ? `Se han marcado ${changed} de ${ids.length}. El resto ya no estaba pendiente.`
        : changed === 1
          ? "1 artículo marcado como comprado."
          : `${changed} artículos marcados como comprados.`,
    )
    setLoading(true)
    await load()
  }

  async function unmark() {
    if (!undo) return
    setBusy(true)
    setError(null)
    const result = await call("admin-unmark-purchased", { id: undo.id })
    setBusy(false)
    if (!result.ok) {
      if (!result.expired) setError(result.message)
      return
    }
    setUndo(null)
    setNotice("El artículo vuelve a estar pendiente.")
    setLoading(true)
    await load()
  }

  return (
    <div className={styles.stack}>
      <h2>Lista de la compra</h2>
      <div className={styles.tabs} role="tablist" aria-label="Vista de la lista">
        <Button variant={view === "pendiente" ? "primary" : "secondary"} aria-pressed={view === "pendiente"} onClick={() => setView("pendiente")}>
          Pendientes
        </Button>
        <Button variant={view === "reciente" ? "primary" : "secondary"} aria-pressed={view === "reciente"} onClick={() => setView("reciente")}>
          Comprado recientemente
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      {loading && (
        <p className={styles.muted}>
          <Spinner label="Cargando la lista" /> Cargando la lista…
        </p>
      )}

      {!loading && view === "pendiente" && groups.length === 0 && <Alert>No hay nada pendiente de comprar.</Alert>}
      {!loading && view === "pendiente" &&
        groups.map((group) => (
          <section key={group.ticketId} className={styles.shop}>
            <div className={styles.shopHead}>
              <p className={styles.shopTitle}>
                <Link className={styles.code} to={`/gestion/${group.code}`}>
                  {group.code}
                </Link>
                <span>{group.location}</span>
              </p>
              <GroupCheck group={group} selected={selected} onToggle={toggleGroup} />
            </div>
            {group.items.map((item) => (
              <label key={item.id} className={styles.shopItem}>
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                <span>{item.description}</span>
              </label>
            ))}
          </section>
        ))}

      {!loading && view === "pendiente" && selected.size > 0 && (
        <div className={styles.bar}>
          <p className={styles.muted}>{selected.size} seleccionado(s)</p>
          <Button onClick={() => setConfirmBuy(true)}>Marcar como comprado</Button>
        </div>
      )}

      {!loading && view === "reciente" && recent.length === 0 && <Alert>No hay compras en los últimos 30 días.</Alert>}
      {!loading && view === "reciente" &&
        recent.map((item) => (
          <article key={item.id} className={styles.block}>
            <div>
              <Link className={styles.code} to={`/gestion/${item.code}`}>
                {item.code}
              </Link>
              <p className={styles.pre}>{item.description}</p>
              <p className={styles.muted}>
                {item.location} · lo pidió {item.requestedBy} · comprado {formatWhen(item.purchasedAt)}
                {item.purchasedBy ? ` por ${item.purchasedBy}` : ""}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setUndo(item)}>
              Volver a pendiente
            </Button>
          </article>
        ))}

      <Confirm
        open={confirmBuy}
        title="Marcar como comprado"
        acceptLabel="Aceptar"
        busy={busy}
        onCancel={() => setConfirmBuy(false)}
        onAccept={() => void markPurchased()}
      >
        <p>Vas a marcar {selected.size} artículo(s) como comprados. Al aceptar, desaparecerán de la lista de la compra.</p>
      </Confirm>
      <Confirm
        open={undo !== null}
        title="Volver a pendiente"
        acceptLabel="Aceptar"
        busy={busy}
        onCancel={() => setUndo(null)}
        onAccept={() => void unmark()}
      >
        <p>Vas a devolver «{undo?.description}» a la lista de pendientes.</p>
      </Confirm>
    </div>
  )
}

function GroupCheck({
  group,
  selected,
  onToggle,
}: {
  group: Group
  selected: Set<string>
  onToggle: (group: Group) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const ids = group.items.map((item) => item.id)
  const all = ids.every((id) => selected.has(id))
  const some = ids.some((id) => selected.has(id))
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some && !all
  }, [some, all])
  return (
    <label className={styles.shopItem}>
      <input ref={ref} type="checkbox" checked={all} onChange={() => onToggle(group)} aria-label={`Seleccionar todos los de ${group.code}`} />
      <span>Todos</span>
    </label>
  )
}
