import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getPhoto } from '../lib/db'

export function Sheet({
  title,
  onClose,
  children,
  action,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  action?: ReactNode
}) {
  // Пока лист открыт, фон не должен прокручиваться под ним.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          {action}
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

/** Фото хранится в IndexedDB; для <img> нужен objectURL, и его надо отзывать. */
export function PhotoThumb({ photoId, className }: { photoId: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    let created: string | null = null
    void getPhoto(photoId).then((blob) => {
      if (!blob || revoked) return
      created = URL.createObjectURL(blob)
      setUrl(created)
    })
    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [photoId])

  if (!url) return <div className={className ?? 'meal-thumb'} aria-hidden />
  return <img className={className ?? 'meal-thumb'} src={url} alt="" />
}

export function Notice({ kind, children }: { kind: 'ok' | 'err' | 'info'; children: ReactNode }) {
  return <div className={`notice ${kind}`}>{children}</div>
}

export function ConfidenceChip({ level }: { level: 'high' | 'medium' | 'low' }) {
  const label = { high: 'уверенно', medium: 'примерно', low: 'грубо' }[level]
  const cls = { high: 'good', medium: '', low: 'warn' }[level]
  return <span className={`chip ${cls}`}>{label}</span>
}
