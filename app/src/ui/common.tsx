import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getPhoto } from '../lib/db'
import type { Alert } from '../lib/safety'

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

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card">
      <div className="card-title">
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

/** Шкала 0–10 пятью крупными кнопками. Ползунок и одиннадцать мелких целей
 *  неудобны рукам, которые затекают, — а этот раздел заполняется каждый день. */
const SCALE_STEPS: { value: number; label: string }[] = [
  { value: 0, label: 'нет' },
  { value: 3, label: 'слабо' },
  { value: 5, label: 'средне' },
  { value: 7, label: 'сильно' },
  { value: 10, label: 'очень' },
]

export function Scale({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="scale">
        {SCALE_STEPS.map((step) => (
          <button
            key={step.value}
            type="button"
            className={value === step.value ? 'on' : ''}
            onClick={() => onChange(step.value)}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Набор переключаемых меток: быстрее и надёжнее, чем вводить текст. */
export function ChipPicker({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="chips">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`chip tap ${selected.includes(option) ? 'on' : ''}`}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function PhotoThumb({ photoId, className }: { photoId: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    void getPhoto(photoId).then((blob) => {
      if (!blob || cancelled) return
      created = URL.createObjectURL(blob)
      setUrl(created)
    })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [photoId])

  if (!url) return <div className={className ?? 'meal-thumb'} aria-hidden />
  return <img className={className ?? 'meal-thumb'} src={url} alt="" />
}

export function Notice({ kind, children }: { kind: 'ok' | 'err' | 'info'; children: ReactNode }) {
  return <div className={`notice ${kind}`}>{children}</div>
}

/** Предупреждение с протоколом действий. Читают его не в лучшем состоянии,
 *  поэтому шаги нумерованные и без лишних слов. */
export function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className={`alert ${alert.level}`}>
      <div className="alert-title">{alert.title}</div>
      <ol className="alert-steps">
        {alert.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {alert.footnote && <div className="small muted" style={{ marginTop: 8 }}>{alert.footnote}</div>}
    </div>
  )
}

export function ConfidenceChip({ level }: { level: 'high' | 'medium' | 'low' }) {
  const label = { high: 'уверенно', medium: 'примерно', low: 'грубо' }[level]
  const cls = { high: 'good', medium: '', low: 'warn' }[level]
  return <span className={`chip ${cls}`}>{label}</span>
}
