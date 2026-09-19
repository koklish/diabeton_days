import { useState } from 'react'
import { useStore } from '../store'
import { STOOL_RU, type GutEntry, type StateEntry } from '../types'
import { Field, Scale, Sheet } from './common'
import { VoiceButton } from './VoiceButton'

/** Состояние и ЖКТ в одном листе: заполняются вечером и вместе.
 *  Лишний экран — лишний повод не заполнить. */
export function StateSheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, showToast } = useStore()
  const [state, setState] = useState<StateEntry>(
    day.state ?? { anxiety: 0, mood: 5, sleepHours: null, sleepQuality: null, panicAttacks: 0 },
  )
  const [gut, setGut] = useState<GutEntry>(
    day.gut ?? { nausea: 0, pain: 0, morningHungerPain: false, stool: 'norm' },
  )
  const [weight, setWeight] = useState(day.weightKg ? String(day.weightKg) : '')
  const [steps, setSteps] = useState(day.steps ? String(day.steps) : '')
  const [notes, setNotes] = useState(day.notes ?? '')

  const save = async () => {
    const weightKg = Number(weight.replace(',', '.'))
    const stepsNum = Number(steps)
    await commitDay({
      ...day,
      state,
      gut,
      weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
      steps: Number.isFinite(stepsNum) && stepsNum > 0 ? Math.round(stepsNum) : undefined,
      notes: notes.trim() || undefined,
    })
    showToast('Сохранено')
    onClose()
  }

  return (
    <Sheet title="Состояние" onClose={onClose}>
      <Scale label="Тревога" value={state.anxiety} onChange={(v) => setState({ ...state, anxiety: v })} />
      <Scale label="Настроение" value={state.mood} onChange={(v) => setState({ ...state, mood: v })} />

      <div className="inline">
        <Field label="Сон, часов">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={state.sleepHours ?? ''}
            onChange={(e) =>
              setState({ ...state, sleepHours: e.target.value ? Number(e.target.value) : null })
            }
          />
        </Field>
        <Field label="Панические атаки">
          <input
            type="number"
            inputMode="numeric"
            value={state.panicAttacks}
            onChange={(e) => setState({ ...state, panicAttacks: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
      </div>

      <div className="divider" />

      <div className="card-title" style={{ marginTop: 12 }}>
        ЖКТ
      </div>
      <Scale label="Тошнота" value={gut.nausea} onChange={(v) => setGut({ ...gut, nausea: v })} />
      <Scale label="Боли" value={gut.pain} onChange={(v) => setGut({ ...gut, pain: v })} />
      <div className="switch">
        <span>Голодные боли с утра</span>
        <input
          type="checkbox"
          checked={gut.morningHungerPain}
          onChange={(e) => setGut({ ...gut, morningHungerPain: e.target.checked })}
        />
      </div>
      <Field label="Стул">
        <select
          value={gut.stool}
          onChange={(e) => setGut({ ...gut, stool: e.target.value as GutEntry['stool'] })}
        >
          {(Object.keys(STOOL_RU) as GutEntry['stool'][]).map((s) => (
            <option key={s} value={s}>
              {STOOL_RU[s]}
            </option>
          ))}
        </select>
      </Field>

      <div className="divider" />

      <div className="inline" style={{ marginTop: 12 }}>
        <Field label="Вес, кг">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="Шаги">
          <input type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </Field>
      </div>

      <Field label="Как прошёл день" hint="Своими словами. Это не отчёт и не оценка.">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        <VoiceButton onText={(t) => setNotes((v) => (v ? `${v} ${t}` : t))} />
      </Field>

      <button className="btn primary block" onClick={() => void save()}>
        Сохранить
      </button>
    </Sheet>
  )
}
