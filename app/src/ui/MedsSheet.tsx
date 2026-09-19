import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import type { MedDose } from '../types'
import { Notice, Sheet } from './common'

/** Препараты за день. Время вечернего метформина фиксируется отдельно:
 *  из него собирается статистика к вопросу эндокринологу про перенос на ночь. */
export function MedsSheet({ onClose }: { onClose: () => void }) {
  const { day, settings, commitDay, showToast } = useStore()
  const [meds, setMeds] = useState<MedDose[]>(day.meds)

  const weekday = new Date(day.date + 'T12:00:00').getDay()
  const planned = settings.profile.meds.filter(
    (m) => m.schedule === 'daily' || (m.schedule === 'weekly' && m.weekday === weekday),
  )

  const fillFromPlan = () => {
    const existing = new Set(meds.map((m) => m.planId))
    const added = planned
      .filter((p) => !existing.has(p.id))
      .map<MedDose>((p) => ({
        id: uid(),
        planId: p.id,
        time: p.time || nowTime(),
        name: p.name,
        dose: p.dose,
        kind: p.kind,
        taken: false,
      }))
    setMeds([...meds, ...added].sort((a, b) => a.time.localeCompare(b.time)))
  }

  const save = async () => {
    await commitDay({ ...day, meds })
    showToast('Сохранено')
    onClose()
  }

  const eveningMetformin = meds.find((m) => m.kind === 'metformin_pm')

  return (
    <Sheet title="Препараты" onClose={onClose}>
      <button className="btn block" style={{ marginBottom: 12 }} onClick={fillFromPlan}>
        Подставить схему на этот день
      </button>

      {meds.length === 0 && <div className="empty">Ничего не отмечено.</div>}

      {meds.map((m) => (
        <div className="row" key={m.id} style={{ gap: 8 }}>
          <input
            type="time"
            value={m.time}
            style={{ width: 96, minHeight: 40 }}
            aria-label={`Время приёма: ${m.name}`}
            onChange={(e) => setMeds((l) => l.map((x) => (x.id === m.id ? { ...x, time: e.target.value } : x)))}
          />
          <div className="main">
            <div>{m.name}</div>
            {m.dose && <div className="small muted">{m.dose}</div>}
          </div>
          <button
            className={`btn sm ${m.taken ? 'primary' : 'ghost'}`}
            style={{ flex: 'none' }}
            onClick={() => setMeds((l) => l.map((x) => (x.id === m.id ? { ...x, taken: !x.taken } : x)))}
          >
            {m.taken ? '✓ принял' : 'принял'}
          </button>
          <button
            className="btn sm ghost danger"
            style={{ flex: 'none' }}
            onClick={() => setMeds((l) => l.filter((x) => x.id !== m.id))}
            aria-label="Убрать"
          >
            ✕
          </button>
        </div>
      ))}

      {eveningMetformin?.taken && (
        <div style={{ marginTop: 12 }}>
          <Notice kind="info">
            Вечерний метформин отмечен на {eveningMetformin.time}. Завтрашний замер натощак попадёт
            в статистику по этой гипотезе — она собирается автоматически, смотри «Связи».
          </Notice>
        </div>
      )}

      <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => void save()}>
        Сохранить
      </button>
    </Sheet>
  )
}
