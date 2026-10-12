import { rpc, serveAdmin } from "../_shared/admin.ts"
import { HttpError, text } from "../_shared/http.ts"
import { signPhotoList } from "../_shared/photos.ts"

serveAdmin(async (staff, body) => {
  const code = text(body.code).trim()
  if (!/^MF-\d+$/i.test(code)) throw new HttpError(400, { ok: false, message: "El código no es válido." })
  const result = await rpc("admin_ticket_detail", { p_actor: staff.id, p_code: code })
  result.photos = await signPhotoList(result.photos)
  return result
})
