import { useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import type { AlcoholEntry, CgmSummary } from '../types'
import { Field, Notice, Sheet } from './common'

/** Алкоголь и сводка с датчика. Алкоголь здесь не «ещё одна запись»:
 *  он роняет сахар с задержкой 4–12 часов, и на гликлазиде это опасно. */
export function ExtrasSheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, showToast } = useStore()
  const [tab, setTab] = useState<'alcohol' | 'cgm'>('alcohol')

  const [time, setTime] = useState(nowTime())
  const [drink, setDrink] = useState('')
  const [units, setUnits] = useState('1')

  const [cgm, setCgm] = useState<CgmSummary>(
    day.cgm ?? {
      periodDays: 14,
      avgMmol: 0,
      eHbA1c: null,
      timeInRangePct: null,
      timeLowPct: null,
      timeVeryLowPct: null,
      maxMmol: null,
      minMmol: null,
    },
  )

  const addAlcohol = async () => {
    const value = Number(units.replace(',', '.'))
    if (!drink.trim() || !Number.isFinite(value) || value <= 0) return
    const entry: AlcoholEntry = { id: uid(), time, drink: drink.trim(), units: value }
    await commitDay({ ...day, alcohol: [...day.alcohol, entry] })
    showToast('Записано. Вечером появится напоминание про ночь.')
    onClose()
  }

  const saveCgm = async () => {
    await commitDay({ ...day, cgm })
    showToast('Сводка сохранена')
    onClose()
  }

  const num = (key: keyof CgmSummary) => (e: { target: { value: string } }) =>
    setCgm({ ...cgm, [key]: e.target.value ? Number(e.target.value.replace(',', '.')) : null })

  return (
    <Sheet title="Ещё" onClose={onClose}>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className={`btn sm ${tab === 'alcohol' ? 'primary' : 'ghost'}`} onClick={() => setTab('alcohol')}>
          Алкоголь
        </button>
        <button className={`btn sm ${tab === 'cgm' ? 'primary' : 'ghost'}`} onClick={() => setTab('cgm')}>
          Датчик
        </button>
      </div>

      {tab === 'alcohol' && (
        <>
          <Notice kind="info">
            Алкоголь не поднимает сахар, а роняет — с задержкой 4–12 часов, чаще ночью.
            На Диабетоне это сочетание опасно. Отметишь — вечером появится напоминание.
          </Notice>

          <div className="inline" style={{ margin: '14px 0 12px' }}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
            <input
              className="narrow"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              aria-label="Порций"
            />
          </div>

          <Field label="Что" hint="Порция ≈ бокал вина, 50 мл крепкого или 0,33 пива.">
            <input type="text" value={drink} onChange={(e) => setDrink(e.target.value)} placeholder="вино сухое" />
          </Field>

          {day.alcohol.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Сегодня уже отмечено</div>
              {day.alcohol.map((a) => (
                <div className="row" key={a.id}>
                  <div className="time">{a.time}</div>
                  <div className="main">{a.drink}</div>
                  <div className="chip">{a.units}</div>
                </div>
              ))}
            </div>
          )}

          <button className="btn primary block" disabled={!drink.trim()} onClick={() => void addAlcohol()}>
            Записать
          </button>
        </>
      )}

      {tab === 'cgm' && (
        <>
          <div className="small muted" style={{ marginBottom: 12 }}>
            Перенеси сводку из приложения датчика — тогда она будет лежать рядом с едой,
            а не в скриншотах.
          </div>
          <div className="inline">
            <Field label="Период, дней">
              <input
                type="number"
                inputMode="numeric"
                value={cgm.periodDays}
                onChange={(e) => setCgm({ ...cgm, periodDays: Number(e.target.value) || 14 })}
              />
            </Field>
            <Field label="Среднее">
              <input type="number" inputMode="decimal" step="0.1" value={cgm.avgMmol || ''} onChange={num('avgMmol')} />
            </Field>
          </div>
          <div className="inline">
            <Field label="eHbA1c, %">
              <input type="number" inputMode="decimal" step="0.1" value={cgm.eHbA1c ?? ''} onChange={num('eHbA1c')} />
            </Field>
            <Field label="В диапазоне, %">
              <input type="number" inputMode="numeric" value={cgm.timeInRangePct ?? ''} onChange={num('timeInRangePct')} />
            </Field>
          </div>
          <div className="inline">
            <Field label="Низкий, %">
              <input type="number" inputMode="decimal" step="0.1" value={cgm.timeLowPct ?? ''} onChange={num('timeLowPct')} />
            </Field>
            <Field label="Очень низкий, %">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={cgm.timeVeryLowPct ?? ''}
                onChange={num('timeVeryLowPct')}
              />
            </Field>
          </div>
          <div className="inline">
            <Field label="Минимум">
              <input type="number" inputMode="decimal" step="0.1" value={cgm.minMmol ?? ''} onChange={num('minMmol')} />
            </Field>
            <Field label="Максимум">
              <input type="number" inputMode="decimal" step="0.1" value={cgm.maxMmol ?? ''} onChange={num('maxMmol')} />
            </Field>
          </div>

          {(cgm.timeVeryLowPct ?? 0) > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Notice kind="info">
                Время в зоне «очень низкий» — {cgm.timeVeryLowPct}%. Это прямой аргумент в разговоре
                про дозу Диабетона.
              </Notice>
            </div>
          )}

          <button className="btn primary block" onClick={() => void saveCgm()}>
            Сохранить сводку
          </button>
        </>
      )}
    </Sheet>
  )
}
