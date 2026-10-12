import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/Button"
import { Confirm } from "../pages/admin/Confirm"
import { compressImage } from "../lib/compressImage"
import { formatWhen } from "../domain/labels"
import styles from "./TicketPhotos.module.css"

export interface TicketPhoto {
  id: string
  url: string | null
  uploadedBy: string
  uploadedById: string | null
  createdAt: string
  error?: boolean
}

export function TicketPhotos({
  code,
  photos,
  busy,
  remaining,
  canDelete,
  onAdd,
  onDelete,
}: {
  code: string
  photos: TicketPhoto[]
  busy: boolean
  remaining: number
  canDelete: (photo: TicketPhoto) => boolean
  onAdd: (blobs: Blob[]) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [pending, setPending] = useState<TicketPhoto | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const touch = useRef<{ x: number } | null>(null)

  useEffect(() => {
    if (open === null) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null)
      if (event.key === "ArrowRight") setOpen((index) => (index === null ? index : (index + 1) % photos.length))
      if (event.key === "ArrowLeft") {
        setOpen((index) => (index === null ? index : (index - 1 + photos.length) % photos.length))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, photos.length])

  async function pick(files: FileList | null) {
    if (!files || files.length === 0 || remaining <= 0) return
    setPhotoError(null)
    const chosen = [...files].slice(0, remaining)
    if (files.length > remaining) {
      setPhotoError(`Solo caben ${remaining} foto${remaining === 1 ? "" : "s"} más. Se quedan las primeras.`)
    }
    setCompressing(true)
    try {
      const blobs: Blob[] = []
      for (const file of chosen) blobs.push(await compressImage(file))
      await onAdd(blobs)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "No se ha podido preparar la foto.")
    } finally {
      setCompressing(false)
      if (cameraRef.current) cameraRef.current.value = ""
      if (galleryRef.current) galleryRef.current.value = ""
    }
  }

  const current = open !== null ? photos[open] : null

  return (
    <section>
      <h3>Fotos</h3>
      {photos.length === 0 && <p className={styles.empty}>Sin foto.</p>}
      {photos.length > 0 && (
        <ul className={styles.thumbs}>
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button type="button" className={styles.thumb} onClick={() => setOpen(index)} disabled={!photo.url}>
                {photo.url ? (
                  <img src={photo.url} alt={`Foto ${index + 1} de ${code}`} />
                ) : (
                  <span>{photo.error ? "No se ha podido cargar." : "Sin foto."}</span>
                )}
              </button>
              <p className={styles.meta}>
                {photo.uploadedBy} · {formatWhen(photo.createdAt)}
              </p>
              {canDelete(photo) && (
                <Button variant="ghost" disabled={busy} onClick={() => setPending(photo)}>
                  Borrar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <div className={styles.add}>
          <label className={styles.fileLabel}>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.file}
              disabled={busy || compressing}
              onChange={(event) => void pick(event.target.files)}
            />
            {compressing ? "Preparando…" : "Hacer foto"}
          </label>
          <label className={styles.fileLabel}>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className={styles.file}
              disabled={busy || compressing}
              onChange={(event) => void pick(event.target.files)}
            />
            Elegir de la galería
          </label>
        </div>
      )}
      {photoError && (
        <p className={styles.error} role="alert">
          {photoError}
        </p>
      )}
      {current && current.url && open !== null && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${open + 1} de ${photos.length}`}
          onClick={() => setOpen(null)}
          onTouchStart={(event) => {
            touch.current = { x: event.changedTouches[0]?.clientX ?? 0 }
          }}
          onTouchEnd={(event) => {
            const start = touch.current?.x
            touch.current = null
            if (start === undefined) return
            const delta = (event.changedTouches[0]?.clientX ?? start) - start
            if (delta < -40) setOpen((index) => (index === null ? index : (index + 1) % photos.length))
            if (delta > 40) setOpen((index) => (index === null ? index : (index - 1 + photos.length) % photos.length))
          }}
        >
          <div className={styles.stage} onClick={(event) => event.stopPropagation()}>
            <img src={current.url} alt={`Foto ${open + 1} de ${code}`} />
            <p>
              {current.uploadedBy} · {formatWhen(current.createdAt)} · {open + 1}/{photos.length}
            </p>
            <div className={styles.nav}>
              {photos.length > 1 && (
                <Button variant="secondary" onClick={() => setOpen((index) => (index === null ? 0 : (index - 1 + photos.length) % photos.length))}>
                  Anterior
                </Button>
              )}
              <Button variant="primary" onClick={() => setOpen(null)}>
                Cerrar
              </Button>
              {photos.length > 1 && (
                <Button variant="secondary" onClick={() => setOpen((index) => (index === null ? 0 : (index + 1) % photos.length))}>
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <Confirm
        open={pending !== null}
        title="Borrar foto"
        acceptLabel="Borrar"
        danger
        busy={busy}
        onCancel={() => setPending(null)}
        onAccept={() => {
          if (!pending) return
          void onDelete(pending.id).then((ok) => {
            if (ok) setPending(null)
          })
        }}
      >
        <p>Vas a borrar esta foto de {code}. No se puede deshacer.</p>
      </Confirm>
    </section>
  )
}
