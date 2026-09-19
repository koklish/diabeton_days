import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import { ACTIVITY_KIND_RU, MEAL_KIND_RU, type ActivityEntry } from '../types'
import { Field, Notice, Sheet } from './common'

/** Движение. Прогулка после еды реально срезает пик, поэтому привязка
 *  к приёму важнее, чем сами минуты. */
export function ActivitySheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, showToast } = useStore()
  const [time, setTime] = useState(nowTime())
  const [kind, setKind] = useState<ActivityEntry['kind']>('walk')
  const [minutes, setMinutes] = useState('20')
  const [afterMealId, setAfterMealId] = useState(day.meals[day.meals.length - 1]?.id ?? '')

  const save = async () => {
    const value = Number(minutes)
    if (!Number.isFinite(value) || value <= 0) return
    const entry: ActivityEntry = {
      id: uid(),
      time,
      kind,
      minutes: Math.round(value),
      afterMealId: afterMealId || undefined,
    }
    await commitDay({
      ...day,
      activity: [...day.activity, entry].sort((a, b) => a.time.localeCompare(b.time)),
    })
    showToast('Записано')
    onClose()
  }

  return (
    <Sheet title="Движение" onClose={onClose}>
      <div className="inline" style={{ marginBottom: 12 }}>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ActivityEntry['kind'])}
          aria-label="Что было"
        >
          {(Object.keys(ACTIVITY_KIND_RU) as ActivityEntry['kind'][]).map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_KIND_RU[k]}
            </option>
          ))}
        </select>
      </div>

      <Field label="Минут">
        <div className="btn-row" style={{ marginBottom: 8 }}>
          {['15', '20', '30', '45'].map((v) => (
            <button
              key={v}
              className={`btn sm ${minutes === v ? 'primary' : 'ghost'}`}
              onClick={() => setMinutes(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </Field>

      {day.meals.length > 0 ? (
        <Field label="После какого приёма" hint="Без этой связи не видно, срезает ли прогулка пик.">
          <select value={afterMealId} onChange={(e) => setAfterMealId(e.target.value)}>
            <option value="">просто так</option>
            {day.meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.time} · {m.title || MEAL_KIND_RU[m.kind]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Notice kind="info">Приёмов пищи сегодня ещё нет — привязать прогулку не к чему.</Notice>
        </div>
      )}

      <button className="btn primary block" onClick={() => void save()}>
        Записать
      </button>
    </Sheet>
  )
}
