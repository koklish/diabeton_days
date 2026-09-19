import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import type { MedDose } from '../types'
import { Field, Sheet } from './common'

export function NoteSheet({ onClose }: { onClose: () => void }) {
  const { day, settings, commitDay, showToast } = useStore()
  const [notes, setNotes] = useState(day.notes ?? '')
  const [meds, setMeds] = useState<MedDose[]>(day.meds)
  const [weight, setWeight] = useState(day.weightKg ? String(day.weightKg) : '')
  const [steps, setSteps] = useState(day.steps ? String(day.steps) : '')

  const save = async () => {
    const weightKg = Number(weight.replace(',', '.'))
    const stepsNum = Number(steps)
    await commitDay({
      ...day,
      notes: notes.trim() || undefined,
      meds,
      weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
      steps: Number.isFinite(stepsNum) && stepsNum > 0 ? Math.round(stepsNum) : undefined,
    })
    showToast('Сохранено')
    onClose()
  }

  /** Подставить схему из настроек — чтобы не набирать названия каждый день. */
  const fillFromSettings = () => {
    const existing = new Set(meds.map((m) => `${m.name}@${m.time}`))
    const added = settings.medications
      .filter((m) => !existing.has(`${m.name}@${m.time}`))
      .map((m) => ({ id: uid(), time: m.time || nowTime(), name: m.name, dose: m.dose, taken: false }))
    setMeds([...meds, ...added].sort((a, b) => a.time.localeCompare(b.time)))
  }

  return (
    <Sheet title="Заметки и препараты" onClose={onClose}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">
          <span>Препараты</span>
          <button className="btn sm ghost" onClick={fillFromSettings} disabled={settings.medications.length === 0}>
            Из схемы
          </button>
        </div>
        {meds.length === 0 && (
          <div className="empty">
            {settings.medications.length === 0
              ? 'Постоянная схема не заполнена — задайте её в «Настройках».'
              : 'Нажмите «Из схемы», чтобы подставить обычный приём.'}
          </div>
        )}
        {meds.map((m) => (
          <div className="row" key={m.id}>
            <input
              className="time"
              type="time"
              value={m.time}
              style={{ width: 96, minHeight: 38 }}
              onChange={(e) => setMeds((l) => l.map((x) => (x.id === m.id ? { ...x, time: e.target.value } : x)))}
            />
            <div className="main">
              <div>{m.name}</div>
              {m.dose && <div className="small muted">{m.dose}</div>}
            </div>
            <button
              className={`btn sm ${m.taken ? 'primary' : 'ghost'}`}
              onClick={() => setMeds((l) => l.map((x) => (x.id === m.id ? { ...x, taken: !x.taken } : x)))}
            >
              {m.taken ? '✓' : 'Принял'}
            </button>
            <button
              className="btn sm ghost danger"
              onClick={() => setMeds((l) => l.filter((x) => x.id !== m.id))}
              aria-label="Удалить"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="inline" style={{ marginBottom: 12 }}>
        <Field label="Вес, кг">
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label="Шаги">
          <input type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </Field>
      </div>

      <Field label="Заметка за день" hint="Самочувствие, нагрузка, стресс, сон — всё, что помогает объяснить цифры позже.">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <button className="btn primary block" onClick={() => void save()}>
        Сохранить
      </button>
    </Sheet>
  )
}
