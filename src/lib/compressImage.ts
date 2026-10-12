import { LIMITS } from "../domain/ticketRules"

const MAX_SIDE = 1600
const START_QUALITY = 0.7

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se ha podido preparar la foto."))),
      "image/jpeg",
      quality,
    )
  })
}

async function bitmapFromImage(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("decode"))
      img.src = url
    })
    return await createImageBitmap(image)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function bitmapFromHeic(file: File): Promise<ImageBitmap> {
  const { default: heic2any } = await import("heic2any")
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 })
  const jpeg = Array.isArray(result) ? result[0] : result
  if (!(jpeg instanceof Blob)) throw new Error("decode")
  return await createImageBitmap(jpeg)
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    try {
      return await bitmapFromImage(file)
    } catch {
      return await bitmapFromHeic(file)
    }
  }
}

/**
 * Reduce la foto a como máximo 1600 px de lado, JPEG, por debajo de 500 KB.
 * Al pasarla por un canvas se elimina el EXIF (ubicación, modelo de móvil…).
 * Una foto HEIC del iPhone se convierte a JPEG antes de salir del navegador.
 */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file)
  } catch {
    throw new Error("No puedo usar esta foto. Hazla de nuevo o elige una imagen JPG o PNG.")
  }

  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    let blob: Blob | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No se ha podido preparar la foto.")
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      let quality = START_QUALITY
      blob = await toBlob(canvas, quality)
      while (blob.size > LIMITS.photoBytes && quality > 0.45) {
        quality = Math.round((quality - 0.1) * 10) / 10
        blob = await toBlob(canvas, quality)
      }
      if (blob.size <= LIMITS.photoBytes) return blob
      scale *= 0.7
    }

    throw new Error("La foto sigue siendo demasiado grande. Prueba a hacerla más de cerca o elige otra.")
  } finally {
    bitmap.close()
  }
}
