import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import { formatWhen } from "../domain/labels"
import { Button } from "./ui/Button"
import { Confirm } from "../pages/admin/Confirm"
import styles from "./Materials.module.css"

export interface MaterialItem {
  id: string
  description: string
  status: "pendiente" | "comprado"
  requestedBy: string
  createdAt: string
  purchasedBy: string | null
  purchasedAt: string | null
}

export function Materials({
  items,
  busy,
  canMutate,
  canPurchase,
  onAdd,
  onEdit,
  onDelete,
  onBuy,
  onUnmark,
}: {
  items: MaterialItem[]
  busy: boolean
  canMutate: boolean
  canPurchase: boolean
  onAdd: (text: string) => Promise<boolean>
  onEdit: (id: string, description: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onBuy?: (id: string) => Promise<boolean>
  onUnmark?: (id: string) => Promise<boolean>
}) {
  const [adding, setAdding] = useState(false)
  const [addText, setAddText] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [remove, setRemove] = useState<MaterialItem | null>(null)
  const [buy, setBuy] = useState<MaterialItem | null>(null)
  const [undo, setUndo] = useState<MaterialItem | null>(null)

  useEffect(() => {
    setAdding(false)
    setAddText("")
    setEditingId(null)
    setEditText("")
    setRemove(null)
    setBuy(null)
    setUndo(null)
  }, [items])

  async function submitAdd(event: FormEvent) {
    event.preventDefault()
    if (addText.trim() === "") return
    const ok = await onAdd(addText)
    if (ok) {
      setAddText("")
      setAdding(false)
    }
  }

  async function saveEdit() {
    if (!editingId || editText.trim() === "") return
    const ok = await onEdit(editingId, editText)
    if (ok) {
      setEditingId(null)
      setEditText("")
    }
  }

  function onEditKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void saveEdit()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setEditingId(null)
      setEditText("")
    }
  }

  return (
    <section className={styles.section}>
      <h3>Materiales</h3>
      {items.length === 0 && (
        <p className={styles.empty}>{canMutate ? "Sin materiales. Pulsa + para añadir uno." : "Sin materiales."}</p>
      )}
      <ul className={styles.list}>
        {items.map((item) => {
          const editing = editingId === item.id && item.status === "pendiente" && canMutate
          return (
            <li key={item.id} className={styles.row}>
              {editing ? (
                <div className={styles.edit}>
                  <input
                    className={styles.input}
                    value={editText}
                    maxLength={200}
                    aria-label="Texto del material"
                    autoFocus
                    disabled={busy}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={onEditKey}
                  />
                  <Button disabled={busy || editText.trim() === ""} onClick={() => void saveEdit()}>
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(null)
                      setEditText("")
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <>
                  <div className={styles.info}>
                    <p className={styles.name}>{item.description}</p>
                    <p className={styles.meta}>
                      Lo pidió {item.requestedBy} · {formatWhen(item.createdAt)}
                      {" · "}
                      <span className={item.status === "pendiente" ? styles.pending : styles.bought}>
                        {item.status === "pendiente"
                          ? "Pendiente"
                          : `Comprado${item.purchasedAt ? ` ${formatWhen(item.purchasedAt)}` : ""}`}
                      </span>
                    </p>
                  </div>
                  <div className={styles.actions}>
                    {canMutate && item.status === "pendiente" && (
                      <>
                        <button
                          type="button"
                          className={styles.icon}
                          aria-label={`Editar ${item.description}`}
                          disabled={busy}
                          onClick={() => {
                            setEditingId(item.id)
                            setEditText(item.description)
                          }}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.icon}
                          aria-label={`Borrar ${item.description}`}
                          disabled={busy}
                          onClick={() => setRemove(item)}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                    {canPurchase && item.status === "pendiente" && onBuy && (
                      <Button variant="secondary" disabled={busy} onClick={() => setBuy(item)}>
                        Marcar como comprado
                      </Button>
                    )}
                    {canPurchase && item.status === "comprado" && onUnmark && (
                      <Button variant="secondary" disabled={busy} onClick={() => setUndo(item)}>
                        Volver a pendiente
                      </Button>
                    )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {canMutate && !adding && (
        <Button variant="secondary" disabled={busy} onClick={() => setAdding(true)}>
          + Añadir material
        </Button>
      )}
      {canMutate && adding && (
        <form className={styles.add} onSubmit={(event) => void submitAdd(event)}>
          <label className={styles.addLabel}>
            Nuevo material
            <textarea
              className={styles.textarea}
              value={addText}
              maxLength={8000}
              rows={3}
              placeholder="Un artículo por línea"
              disabled={busy}
              autoFocus
              onChange={(event) => setAddText(event.target.value)}
            />
          </label>
          <div className={styles.edit}>
            <Button type="submit" disabled={busy || addText.trim() === ""}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAdding(false)
                setAddText("")
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <Confirm
        open={remove !== null}
        title="Borrar material"
        acceptLabel="Borrar"
        danger
        busy={busy}
        onCancel={() => setRemove(null)}
        onAccept={() => {
          if (!remove) return
          void onDelete(remove.id).then((ok) => {
            if (ok) setRemove(null)
          })
        }}
      >
        ¿Borrar «{remove?.description}»?
      </Confirm>
      <Confirm
        open={buy !== null}
        title="Marcar como comprado"
        acceptLabel="Aceptar"
        busy={busy}
        onCancel={() => setBuy(null)}
        onAccept={() => {
          if (!buy || !onBuy) return
          void onBuy(buy.id).then((ok) => {
            if (ok) setBuy(null)
          })
        }}
      >
        <p>Vas a marcar 1 artículo(s) como comprados. Al aceptar, desaparecerán de la lista de la compra.</p>
      </Confirm>
      <Confirm
        open={undo !== null}
        title="Volver a pendiente"
        acceptLabel="Aceptar"
        busy={busy}
        onCancel={() => setUndo(null)}
        onAccept={() => {
          if (!undo || !onUnmark) return
          void onUnmark(undo.id).then((ok) => {
            if (ok) setUndo(null)
          })
        }}
      >
        <p>Vas a devolver «{undo?.description}» a la lista de pendientes.</p>
      </Confirm>
    </section>
  )
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
