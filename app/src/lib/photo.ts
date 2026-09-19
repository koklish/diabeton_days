import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export interface CapturedPhoto {
  blob: Blob
  /** base64 без префикса data: — в таком виде его ждёт Messages API. */
  base64: string
  mediaType: 'image/jpeg'
  width: number
  height: number
}

/** Фото с телефона — это 8–12 Мп. В модель столько не нужно, а трафик и время
 *  ответа растут линейно, поэтому ужимаем до разумной стороны. */
const MAX_SIDE = 1400
const QUALITY = 0.85

async function fileToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.src = url
    })
    return img
  } finally {
    // URL нужен до onload, освобождаем на следующем тике.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export async function downscale(input: Blob): Promise<CapturedPhoto> {
  const img = await fileToImage(input)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось сжать изображение'))),
      'image/jpeg',
      QUALITY,
    )
  })
  return { blob, base64: await blobToBase64(blob), mediaType: 'image/jpeg', width, height }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Снять камерой. В браузере Capacitor подставляет свой web-вариант,
 *  но системный input надёжнее на Android-браузерах — используем его. */
export async function takePhoto(source: 'camera' | 'gallery'): Promise<CapturedPhoto | null> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
    })
    if (!photo.webPath) return null
    const res = await fetch(photo.webPath)
    return downscale(await res.blob())
  }
  return pickFile(source === 'camera')
}

function pickFile(useCamera: boolean): Promise<CapturedPhoto | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (useCamera) input.setAttribute('capture', 'environment')
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return resolve(null)
      downscale(file).then(resolve, reject)
    }
    // Отмена в системном диалоге не даёт события в старых WebView —
    // подчищаем элемент, когда окно снова получает фокус.
    window.addEventListener(
      'focus',
      () => setTimeout(() => { if (!input.files?.length) { input.remove(); resolve(null) } }, 800),
      { once: true },
    )
    input.click()
  })
}
