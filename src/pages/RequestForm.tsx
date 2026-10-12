import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Alert } from "../components/ui/Alert"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Input, Textarea } from "../components/ui/Field"
import { Modal } from "../components/ui/Modal"
import { rgpdText } from "../content/rgpd"
import { LIMITS, PHOTO_WARNING, REVIEW_MESSAGE, validateTicket } from "../domain/ticketRules"
import { createTicket, NetworkError } from "../lib/api"
import { compressImage } from "../lib/compressImage"
import styles from "./RequestForm.module.css"

interface PhotoState {
  blob: Blob
  preview: string
}

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const EMPTY = { name: "", email: "", description: "", location: "", notes: "" }

export function RequestForm() {
  const [fields, setFields] = useState(EMPTY)
  const [rgpd, setRgpd] = useState(false)
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const photoRequest = useRef(0)
  const photoRef = useRef<PhotoState | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const rgpdId = useId()
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (!focusId) return
    const el = document.getElementById(focusId)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.focus({ preventScroll: true })
    }
    setFocusId(null)
  }, [focusId, errors])

  useEffect(() => {
    if (Object.keys(errors).length === 0 && formError === REVIEW_MESSAGE) setFormError(null)
  }, [errors, formError])

  useEffect(() => {
    return () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
    }
  }, [])

  function replacePhoto(next: PhotoState | null) {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
    photoRef.current = next
    setPhoto(next)
  }

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function onPhoto(file: File | undefined) {
    const request = ++photoRequest.current
    setPhotoError(null)
    setErrors((prev) => {
      if (!prev.photo) return prev
      const next = { ...prev }
      delete next.photo
      return next
    })
    if (!file) return
    setCompressing(true)
    try {
      const blob = await compressImage(file)
      if (request !== photoRequest.current) return
      replacePhoto({ blob, preview: URL.createObjectURL(blob) })
    } catch (error) {
      if (request !== photoRequest.current) return
      setPhotoError(error instanceof Error ? error.message : "No se ha podido preparar la foto.")
    } finally {
      if (request === photoRequest.current) setCompressing(false)
    }
  }

  function removePhoto() {
    photoRequest.current += 1
    setCompressing(false)
    replacePhoto(null)
    setPhotoError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  function clearForm() {
    setFields(EMPTY)
    setRgpd(false)
    removePhoto()
    setErrors({})
    setFormError(null)
  }

  function firstErrorId(found: Record<string, string>): string | null {
    const order = [
      ["name", "parte-name"],
      ["email", "parte-email"],
      ["description", "parte-description"],
      ["location", "parte-location"],
      ["photo", "parte-photo"],
      ["notes", "parte-notes"],
      ["rgpd", rgpdId],
    ] as const
    for (const [key, id] of order) {
      if (found[key]) return id
    }
    return null
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    const found = validateTicket({ ...fields, rgpd })
    if (photoError) found.photo = photoError
    setErrors(found)
    if (Object.keys(found).length > 0 || compressing) {
      setFormError(REVIEW_MESSAGE)
      setFocusId(firstErrorId(found) ?? (compressing ? "parte-photo" : null))
      return
    }

    setSending(true)
    try {
      const result = await createTicket(fields, photo?.blob ?? null)
      if (!result.ok) {
        if (result.fields) setErrors(result.fields)
        setFormError(result.message)
        if (result.fields) setFocusId(firstErrorId(result.fields))
        return
      }
      clearForm()
      setDone(true)
    } catch (error) {
      setFormError(error instanceof NetworkError ? error.message : "No se ha podido enviar. Tus datos siguen en el formulario.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Abrir un parte</h1>
        <p className={styles.lead}>Cuéntanos qué se ha estropeado y dónde. El equipo de mantenimiento lo verá enseguida.</p>
      </header>

      <Card>
        <form className={styles.form} noValidate onSubmit={onSubmit}>
          <Input
            id="parte-name"
            label="Nombre"
            required
            autoComplete="name"
            maxLength={LIMITS.name}
            value={fields.name}
            error={errors.name}
            placeholder="Tu nombre y apellidos"
            onChange={(e) => set("name", e.target.value)}
          />
          <Input
            id="parte-email"
            label="Email corporativo"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={LIMITS.email}
            value={fields.email}
            error={errors.email}
            placeholder="nombre@grupomontaignesevilla.com"
            hint="Te escribiremos a este email cuando esté solucionado."
            onChange={(e) => set("email", e.target.value)}
          />
          <Textarea
            id="parte-description"
            label="Reparación necesaria"
            required
            maxLength={LIMITS.description}
            value={fields.description}
            error={errors.description}
            placeholder="Qué se ha estropeado"
            onChange={(e) => set("description", e.target.value)}
          />
          <Input
            id="parte-location"
            label="Lugar"
            required
            maxLength={LIMITS.location}
            value={fields.location}
            error={errors.location}
            placeholder="Aula, planta, patio, auditorio, baños…"
            hint="Cuanto más concreto, antes lo encontramos."
            onChange={(e) => set("location", e.target.value)}
          />

          <div className={styles.photo}>
            <p className={styles.photoLabel} id="foto-label">
              Foto <span className={styles.optional}>(opcional)</span>
            </p>
            <Alert tone="warning">{PHOTO_WARNING}</Alert>
            <label className={styles.fileLabel}>
              <input
                id="parte-photo"
                ref={fileRef}
                type="file"
                accept="image/*"
                className={styles.file}
                aria-labelledby="foto-label"
                aria-invalid={errors.photo ? true : undefined}
                aria-describedby={errors.photo ? "parte-photo-error" : undefined}
                onChange={(e) => void onPhoto(e.target.files?.[0])}
              />
              {compressing ? "Preparando la foto…" : "Hacer o elegir una foto"}
            </label>
            {photo && (
              <figure className={styles.preview}>
                <img src={photo.preview} alt="Foto que se enviará con el parte" />
                <Button variant="ghost" onClick={removePhoto}>
                  Quitar foto
                </Button>
              </figure>
            )}
            {(photoError || errors.photo) && (
              <p id="parte-photo-error" className={styles.photoError} role="alert">
                {photoError ?? errors.photo}
              </p>
            )}
          </div>

          <Textarea
            id="parte-notes"
            label="Observaciones adicionales"
            maxLength={LIMITS.notes}
            value={fields.notes}
            error={errors.notes}
            placeholder="Cualquier detalle que nos ayude"
            onChange={(e) => set("notes", e.target.value)}
          />

          <div className={`${styles.rgpd} ${errors.rgpd ? styles.rgpdInvalid : ""}`}>
            <label className={styles.rgpdLabel} htmlFor={rgpdId}>
              <input
                id={rgpdId}
                type="checkbox"
                checked={rgpd}
                aria-invalid={errors.rgpd ? true : undefined}
                aria-describedby={errors.rgpd ? `${rgpdId}-error` : undefined}
                onChange={(e) => {
                  setRgpd(e.target.checked)
                  setErrors((prev) => {
                    if (!prev.rgpd) return prev
                    const next = { ...prev }
                    delete next.rgpd
                    return next
                  })
                }}
              />
              <span>{rgpdText}</span>
            </label>
            {errors.rgpd && (
              <p id={`${rgpdId}-error`} className={styles.photoError} role="alert">
                {errors.rgpd}
              </p>
            )}
          </div>

          {formError && (
            <Alert tone="error">{formError}</Alert>
          )}

          <Button type="submit" size="lg" fullWidth loading={sending} disabled={compressing || sending}>
            {sending ? "Enviando…" : "Enviar parte"}
          </Button>
        </form>
      </Card>

      <Modal
        open={done}
        onClose={() => setDone(false)}
        icon={<CheckIcon />}
        title="Solicitud enviada"
        actions={
          <Button size="lg" fullWidth onClick={() => setDone(false)}>
            Entendido
          </Button>
        }
      >
        <p>Gracias, atenderemos tu solicitud lo antes posible. Recibirás un correo en tu email cuando esté solucionado.</p>
      </Modal>
    </div>
  )
}
