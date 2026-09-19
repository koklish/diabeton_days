import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import { GLUCOSE_TAG_RU, type GlucoseTag } from '../types'
import { Field, Notice, Sheet } from './common'

export function GlucoseSheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, settings, showToast } = useStore()
  const [time, setTime] = useState(nowTime())
  const [value, setValue] = useState('')
  const [tag, setTag] = useState<GlucoseTag>('before_meal')
  const [note, setNote] = useState('')

  const mmol = Number(value.replace(',', '.'))
  const valid = Number.isFinite(mmol) && mmol > 0 && mmol < 40

  const save = async () => {
    if (!valid) return
    const reading = { id: uid(), time, mmol: Math.round(mmol * 10) / 10, tag, note: note.trim() || undefined }
    const glucose = [...day.glucose, reading].sort((a, b) => a.time.localeCompare(b.time))
    await commitDay({ ...day, glucose })
    showToast('Замер записан')
    onClose()
  }

  return (
    <Sheet title="Замер глюкозы" onClose={onClose}>
      <div className="inline" style={{ marginBottom: 12 }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
        <select value={tag} onChange={(e) => setTag(e.target.value as GlucoseTag)} aria-label="Когда">
          {(Object.keys(GLUCOSE_TAG_RU) as GlucoseTag[]).map((t) => (
            <option key={t} value={t}>
              {GLUCOSE_TAG_RU[t]}
            </option>
          ))}
        </select>
      </div>

      <Field label="Глюкоза, ммоль/л" hint={`Ваш коридор: ${settings.glucoseLow}–${settings.glucoseHigh} ммоль/л`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="например 6.4"
          autoFocus
        />
      </Field>

      {valid && mmol < 3.9 && (
        <div style={{ marginBottom: 12 }}>
          <Notice kind="err">
            Это гипогликемия. Примите быстрые углеводы (15 г: 3–4 таблетки глюкозы или 150 мл сока)
            и перемерьте через 15 минут. Гликлазид может давать отсроченное повторное падение —
            при повторе или плохом самочувствии обратитесь за медицинской помощью.
          </Notice>
        </div>
      )}

      <Field label="Заметка">
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Самочувствие, обстоятельства" />
      </Field>

      <button className="btn primary block" disabled={!valid} onClick={() => void save()}>
        Записать
      </button>
    </Sheet>
  )
}
