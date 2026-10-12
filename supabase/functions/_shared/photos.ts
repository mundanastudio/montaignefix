import { requirePerson, type Staff } from "./auth.ts"
import { rpc, signPhoto, uuid } from "./admin.ts"
import { HttpError, admin, db, handle, json, readJson } from "./http.ts"

export const MAX_PHOTO_BYTES = 1_500_000
export const MAX_FORM_PHOTOS = 3
export const MAX_TICKET_PHOTOS = 10

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function filesFromForm(form: FormData, max: number): Promise<Uint8Array[]> {
  const files = form.getAll("photo").filter((item): item is File => item instanceof File && item.size > 0)
  if (files.length > max) {
    throw new HttpError(400, {
      ok: false,
      message: max <= MAX_FORM_PHOTOS ? "Puedes enviar como máximo 3 fotos." : "Este parte ya tiene 10 fotos.",
    })
  }
  const images: Uint8Array[] = []
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      throw new HttpError(413, {
        ok: false,
        message: "La foto es demasiado grande. Hazla de nuevo.",
        fields: { photo: "La foto es demasiado grande." },
      })
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isJpeg(bytes)) {
      throw new HttpError(400, {
        ok: false,
        message: "La foto tiene que ser una imagen JPG.",
        fields: { photo: "La foto tiene que ser una imagen JPG." },
      })
    }
    images.push(bytes)
  }
  return images
}

export async function uploadTicketPhotos(ticketId: string, images: Uint8Array[]): Promise<string[]> {
  const bucket = admin().storage.from("montaigne-fix-fotos")
  const paths: string[] = []
  try {
    for (const bytes of images) {
      const path = `${ticketId}/${crypto.randomUUID()}.jpg`
      const { error } = await bucket.upload(path, bytes, { contentType: "image/jpeg", upsert: false })
      if (error) throw new HttpError(500, { ok: false, message: "No se ha podido guardar la foto. Inténtalo de nuevo." })
      paths.push(path)
    }
    return paths
  } catch (error) {
    if (paths.length > 0) await bucket.remove(paths)
    throw error
  }
}

export async function removeStorage(paths: string[]): Promise<{ ok: boolean; error: string | null }> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return { ok: true, error: null }
  const { error } = await admin().storage.from("montaigne-fix-fotos").remove(unique)
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

export async function listTicketPhotoPaths(ticketId: string): Promise<string[]> {
  const { data, error } = await db().rpc("ticket_photo_paths", { p_ticket: ticketId })
  if (error) {
    console.error("fotos-rutas", error.code ?? "error")
    throw new HttpError(500, { ok: false, message: "No se han podido borrar las fotos. El parte no se ha eliminado." })
  }
  const fromSql = Array.isArray(data) ? data.filter((item): item is string => typeof item === "string" && item !== "") : []
  const folder = await admin().storage.from("montaigne-fix-fotos").list(ticketId, { limit: 100 })
  const extra = (folder.data ?? []).map((item) => `${ticketId}/${item.name}`)
  return [...new Set([...fromSql, ...extra])]
}

export async function recordOrphan(ticketId: string | null, path: string): Promise<void> {
  const { error } = await db().from("storage_orphans").insert({ ticket_id: ticketId, path })
  if (error) console.error("foto-huerfana", error.code ?? "insert")
}

export async function signPhotoList(photos: unknown): Promise<Record<string, unknown>[]> {
  if (!Array.isArray(photos)) return []
  const signed: Record<string, unknown>[] = []
  for (const item of photos) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const path = typeof row.path === "string" ? row.path : ""
    const url = await signPhoto(path)
    signed.push({
      id: row.id,
      url,
      uploadedBy: row.uploadedBy,
      uploadedById: row.uploadedById ?? null,
      createdAt: row.createdAt,
      error: Boolean(path) && !url,
    })
  }
  return signed
}

export function serveAddPhotos(asManager: boolean) {
  Deno.serve((req) =>
    handle(req, async () => {
      const staff = await requirePerson(req, asManager ? "admin" : "team", asManager ? "is_manager" : "is_technician")
      let form: FormData
      try {
        form = await req.formData()
      } catch {
        throw new HttpError(400, { ok: false, message: "No se ha podido leer el formulario. Inténtalo de nuevo." })
      }
      const ticketId = uuid(form.get("ticketId"))
      const images = await filesFromForm(form, MAX_TICKET_PHOTOS)
      if (images.length === 0) throw new HttpError(400, { ok: false, message: "Añade al menos una foto." })
      const paths = await uploadTicketPhotos(ticketId, images)
      try {
        const result = await rpc("add_ticket_photos", {
          p_actor: staff.id,
          p_ticket: ticketId,
          p_paths: paths,
          p_as_manager: asManager,
        })
        return json(200, { ok: true, ...result })
      } catch (error) {
        await removeStorage(paths)
        throw error
      }
    }),
  )
}

export function serveDeletePhoto(asManager: boolean) {
  Deno.serve((req) =>
    handle(req, async () => {
      const staff: Staff = await requirePerson(req, asManager ? "admin" : "team", asManager ? "is_manager" : "is_technician")
      const body = await readJson(req)
      const result = await rpc("delete_ticket_photo", {
        p_actor: staff.id,
        p_photo: uuid(body.photoId, "No encontramos esa foto."),
        p_as_manager: asManager,
      })
      const path = typeof result.photoPath === "string" ? result.photoPath : ""
      const ticketId = typeof result.ticketId === "string" ? result.ticketId : null
      if (path) {
        const gone = await removeStorage([path])
        if (!gone.ok) {
          console.error("foto-huerfana", gone.error)
          await recordOrphan(ticketId, path)
        }
      }
      return json(200, { ok: true, ...result })
    }),
  )
}
