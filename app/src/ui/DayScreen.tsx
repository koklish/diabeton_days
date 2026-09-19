import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { dayTotals, mealTotals, itemTotals, round, roundTotals } from '../lib/nutrition'
import { formatDateRu, relativeDayLabel, shiftDate, todayKey } from '../lib/date'
import { GLUCOSE_TAG_RU, MEAL_KIND_RU, type Meal } from '../types'
import { PhotoThumb } from './common'
import { AnalyzeSheet } from './AnalyzeSheet'
import { GlucoseSheet } from './GlucoseSheet'
import { MealSheet } from './MealSheet'
import { NoteSheet } from './NoteSheet'

export function DayScreen() {
  const { settings, date, setDate, day } = useStore()
  const [sheet, setSheet] = useState<'analyze' | 'glucose' | 'note' | null>(null)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)

  const totals = useMemo(() => roundTotals(dayTotals(day, settings)), [day, settings])
  const label = relativeDayLabel(date)
  const isFuture = date > todayKey()

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={() => setDate(shiftDate(date, -1))} aria-label="Предыдущий день">
          ‹
        </button>
        <h1>
          {label ?? formatDateRu(date).split(',')[0]}
          <span className="sub">{formatDateRu(date)}</span>
        </h1>
        <button
          className="icon-btn"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={isFuture}
          aria-label="Следующий день"
        >
          ›
        </button>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-title">
            <span>Итого за сутки</span>
            {date !== todayKey() && (
              <button className="btn sm ghost" onClick={() => setDate(todayKey())}>
                К сегодня
              </button>
            )}
          </div>
          <div className="totals">
            <Tot value={totals.kcal} label="ккал" />
            <Tot value={round(totals.carbs)} label="углеводы, г" />
            <Tot value={round(totals.xe, 1)} label="ХЕ" />
            <Tot value={Math.round(totals.gl)} label="гликем. нагр." />
          </div>
          <Progress value={totals.kcal} target={settings.targetKcal} caption="Калории" />
          <Progress value={totals.carbs} target={settings.targetCarbs} caption="Углеводы" />
          <div className="chips" style={{ marginTop: 10 }}>
            <span className="chip">Б {round(totals.protein)} г</span>
            <span className="chip">Ж {round(totals.fat)} г</span>
            <span className="chip">Клетчатка {round(totals.fiber)} г</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>Приёмы пищи</span>
            <span className="muted">{day.meals.length}</span>
          </div>
          {day.meals.length === 0 ? (
            <div className="empty">
              Пока пусто. Нажмите «Фото еды» внизу — снимок разберёт ИИ и сам посчитает КБЖУ и ХЕ.
            </div>
          ) : (
            day.meals.map((meal) => (
              <MealRow key={meal.id} meal={meal} onOpen={() => setEditingMeal(meal)} />
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span>Глюкоза</span>
            <button className="btn sm ghost" onClick={() => setSheet('glucose')}>
              + Замер
            </button>
          </div>
          {day.glucose.length === 0 ? (
            <div className="empty">Замеров нет</div>
          ) : (
            day.glucose.map((g) => {
              const low = g.mmol < settings.glucoseLow
              const high = g.mmol > settings.glucoseHigh
              return (
                <div className="row" key={g.id}>
                  <div className="time">{g.time}</div>
                  <div className="main">
                    <div>{GLUCOSE_TAG_RU[g.tag]}</div>
                    {g.note && <div className="small muted">{g.note}</div>}
                  </div>
                  <div className={`val ${low ? 'chip bad' : high ? 'chip warn' : 'chip good'}`}>
                    {g.mmol.toFixed(1)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span>Заметки и препараты</span>
            <button className="btn sm ghost" onClick={() => setSheet('note')}>
              Изменить
            </button>
          </div>
          {day.meds.length === 0 && !day.notes ? (
            <div className="empty">Ничего не отмечено</div>
          ) : (
            <>
              {day.meds.map((m) => (
                <div className="row" key={m.id}>
                  <div className="time">{m.time}</div>
                  <div className="main">
                    {m.name}
                    {m.dose && <span className="muted"> · {m.dose}</span>}
                  </div>
                  <div className={`chip ${m.taken ? 'good' : 'warn'}`}>{m.taken ? 'принято' : 'не отмечено'}</div>
                </div>
              ))}
              {day.notes && (
                <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {day.notes}
                </div>
              )}
            </>
          )}
        </div>

        <button className="btn primary block" onClick={() => setSheet('analyze')}>
          📷 Фото еды
        </button>
      </div>

      {sheet === 'analyze' && <AnalyzeSheet onClose={() => setSheet(null)} />}
      {sheet === 'glucose' && <GlucoseSheet onClose={() => setSheet(null)} />}
      {sheet === 'note' && <NoteSheet onClose={() => setSheet(null)} />}
      {editingMeal && <MealSheet meal={editingMeal} onClose={() => setEditingMeal(null)} />}
    </>
  )
}

function Tot({ value, label }: { value: number; label: string }) {
  return (
    <div className="tot">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  )
}

function Progress({ value, target, caption }: { value: number; target: number; caption: string }) {
  if (!target) return null
  const pct = Math.min(100, (value / target) * 100)
  const over = value > target
  return (
    <div style={{ marginTop: 8 }}>
      <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{caption}</span>
        <span>
          {Math.round(value)} из {target}
        </span>
      </div>
      <div className="bar">
        <i className={over ? 'over' : ''} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MealRow({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  const { settings } = useStore()
  const t = roundTotals(mealTotals(meal, settings))
  return (
    <div className="meal" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
      <div className="meal-head" onClick={onOpen} role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
        {meal.photoId ? <PhotoThumb photoId={meal.photoId} /> : <div className="meal-thumb" />}
        <div className="t">
          <div className="name">{meal.title}</div>
          <div className="when">
            {meal.time} · {MEAL_KIND_RU[meal.kind]} · {t.grams} г
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="chip key">{t.kcal} ккал</span>
            <span className="chip">У {round(t.carbs)} г</span>
            <span className="chip key">{round(t.xe, 1)} ХЕ</span>
            {meal.editedByUser && <span className="chip">правлено</span>}
          </div>
        </div>
      </div>
      <ul className="items">
        {meal.items.map((item) => {
          const it = itemTotals(item, settings)
          return (
            <li className="item" key={item.id}>
              <span className="n">{item.name || 'Без названия'}</span>
              <span className="g">
                {Math.round(item.grams)} г · {Math.round(it.kcal)} ккал · У {round(it.carbs)}
              </span>
            </li>
          )
        })}
      </ul>
      {meal.note && <div className="small muted">{meal.note}</div>}
    </div>
  )
}
