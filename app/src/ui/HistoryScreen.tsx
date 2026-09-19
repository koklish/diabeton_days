import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { listDays } from '../lib/db'
import { dayTotals, round, roundTotals } from '../lib/nutrition'
import { formatDateRu, relativeDayLabel } from '../lib/date'
import type { DayRecord } from '../types'

export function HistoryScreen({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { settings, day, syncing, syncNow } = useStore()
  const [days, setDays] = useState<DayRecord[]>([])

  // Перечитываем при возврате на вкладку и после правок текущего дня.
  useEffect(() => {
    void listDays().then(setDays)
  }, [day])

  const stats = useMemo(() => {
    const last7 = days.slice(0, 7)
    if (last7.length === 0) return null
    const totals = last7.map((d) => roundTotals(dayTotals(d, settings)))
    const avg = (pick: (t: (typeof totals)[number]) => number) =>
      Math.round((totals.reduce((a, t) => a + pick(t), 0) / totals.length) * 10) / 10
    const readings = last7.flatMap((d) => d.glucose.map((g) => g.mmol))
    return {
      days: last7.length,
      kcal: Math.round(avg((t) => t.kcal)),
      carbs: avg((t) => t.carbs),
      xe: avg((t) => t.xe),
      glucose: readings.length
        ? Math.round((readings.reduce((a, b) => a + b, 0) / readings.length) * 10) / 10
        : null,
      inRange: readings.length
        ? Math.round(
            (readings.filter((v) => v >= settings.glucoseLow && v <= settings.glucoseHigh).length /
              readings.length) *
              100,
          )
        : null,
    }
  }, [days, settings])

  return (
    <>
      <div className="topbar">
        <h1>История</h1>
        <button className="icon-btn" onClick={() => void syncNow()} disabled={syncing} aria-label="Синхронизировать">
          {syncing ? <span className="spinner" /> : '☁'}
        </button>
      </div>

      <div className="content">
        {stats && (
          <div className="card">
            <div className="card-title">Среднее за последние {stats.days} дн.</div>
            <div className="totals">
              <div className="tot">
                <div className="v">{stats.kcal}</div>
                <div className="l">ккал/день</div>
              </div>
              <div className="tot">
                <div className="v">{stats.carbs}</div>
                <div className="l">углеводы</div>
              </div>
              <div className="tot">
                <div className="v">{stats.xe}</div>
                <div className="l">ХЕ</div>
              </div>
              <div className="tot">
                <div className="v">{stats.glucose ?? '—'}</div>
                <div className="l">глюкоза</div>
              </div>
            </div>
            {stats.inRange != null && (
              <div className="small muted" style={{ marginTop: 10 }}>
                В целевом коридоре {settings.glucoseLow}–{settings.glucoseHigh}: {stats.inRange}% замеров
              </div>
            )}
          </div>
        )}

        <div className="card">
          <div className="card-title">
            <span>Дни</span>
            <span className="muted">{days.length}</span>
          </div>
          {days.length === 0 ? (
            <div className="empty">Записей пока нет</div>
          ) : (
            days.map((d) => {
              const t = roundTotals(dayTotals(d, settings))
              const readings = d.glucose.map((g) => g.mmol)
              return (
                <div
                  className="row"
                  key={d.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDay(d.date)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenDay(d.date)
                  }}
                >
                  <div className="main">
                    <div>{relativeDayLabel(d.date) ?? formatDateRu(d.date).split(',')[0]}</div>
                    <div className="small muted">
                      {d.meals.length} приёмов · {t.kcal} ккал · У {round(t.carbs)} г · {round(t.xe, 1)} ХЕ
                    </div>
                  </div>
                  {readings.length > 0 && (
                    <div className="chip">
                      {Math.min(...readings).toFixed(1)}–{Math.max(...readings).toFixed(1)}
                    </div>
                  )}
                  <div className="muted">›</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
