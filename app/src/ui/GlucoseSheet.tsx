import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import { GLUCOSE_TAG_RU, MEAL_KIND_RU, type GlucoseReading, type GlucoseTag } from '../types'
import { hypoProtocol } from '../lib/safety'
import { AlertCard, Field, Sheet } from './common'
import { VoiceButton } from './VoiceButton'

export function GlucoseSheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, settings, showToast } = useStore()
  const [time, setTime] = useState(nowTime())
  const [value, setValue] = useState('')
  const [tag, setTag] = useState<GlucoseTag>('before_meal')
  const [mealId, setMealId] = useState('')
  const [source, setSource] = useState<GlucoseReading['source']>('meter')
  const [note, setNote] = useState('')

  const mmol = Number(value.replace(',', '.'))
  const valid = Number.isFinite(mmol) && mmol > 0 && mmol < 40
  // Протокол показывается сразу при вводе, до сохранения: действовать надо
  // сейчас, а не после того, как запись ляжет в журнал.
  const alert = valid ? hypoProtocol(mmol, settings.profile) : null

  const save = async () => {
    if (!valid) return
    const reading: GlucoseReading = {
      id: uid(),
      time,
      mmol: Math.round(mmol * 10) / 10,
      tag,
      mealId: mealId || undefined,
      source,
      note: note.trim() || undefined,
    }
    await commitDay({
      ...day,
      glucose: [...day.glucose, reading].sort((a, b) => a.time.localeCompare(b.time)),
    })
    showToast('Замер записан')
    onClose()
  }

  const t = settings.profile.targets

  return (
    <Sheet title="Сахар" onClose={onClose}>
      <Field
        label="Ммоль/л"
        hint={`Цель днём ${fmt(t.dayLow)}–${fmt(t.dayHigh)}; утром натощак до ${fmt(t.fastingHigh)}; пик после еды до ${fmt(t.peakOk)}.`}
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="6.4"
          autoFocus
        />
      </Field>

      {alert && (
        <div style={{ marginBottom: 14 }}>
          <AlertCard alert={alert} />
        </div>
      )}

      <div className="inline" style={{ marginBottom: 12 }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
        <select value={tag} onChange={(e) => setTag(e.target.value as GlucoseTag)} aria-label="Когда">
          {(Object.keys(GLUCOSE_TAG_RU) as GlucoseTag[]).map((k) => (
            <option key={k} value={k}>
              {GLUCOSE_TAG_RU[k]}
            </option>
          ))}
        </select>
      </div>

      {day.meals.length > 0 && (
        <Field label="К какому приёму" hint="Так строится связь «еда → сахар». Без неё приём остаётся без отклика.">
          <select value={mealId} onChange={(e) => setMealId(e.target.value)}>
            <option value="">не привязывать</option>
            {day.meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.time} · {m.title || MEAL_KIND_RU[m.kind]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Откуда цифра">
        <select value={source} onChange={(e) => setSource(e.target.value as GlucoseReading['source'])}>
          <option value="meter">Глюкометр</option>
          <option value="cgm">Датчик</option>
        </select>
      </Field>

      <Field label="Заметка">
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        <VoiceButton onText={(x) => setNote((v) => (v ? `${v} ${x}` : x))} />
      </Field>

      <button className="btn primary block" disabled={!valid} onClick={() => void save()}>
        Записать
      </button>
    </Sheet>
  )
}

function fmt(v: number): string {
  return v.toFixed(1).replace('.', ',')
}
