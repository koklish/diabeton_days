import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { mealTotals, plateSummary, round } from '../lib/nutrition'
import { formatDateRu, relativeDayLabel, shiftDate, todayKey } from '../lib/date'
import { asMap, mealResponse } from '../lib/history'
import {
  ACTIVITY_KIND_RU,
  CRAVING_OUTCOME_RU,
  GLUCOSE_TAG_RU,
  MEAL_KIND_RU,
  STOOL_RU,
  type Meal,
} from '../types'
import { AlertCard, Card, PhotoThumb } from './common'
import { AnalyzeSheet } from './AnalyzeSheet'
import { GlucoseSheet } from './GlucoseSheet'
import { HandsSheet } from './HandsSheet'
import { StateSheet } from './StateSheet'
import { ActivitySheet } from './ActivitySheet'
import { MedsSheet } from './MedsSheet'
import { ExtrasSheet } from './ExtrasSheet'
import { MealSheet } from './MealSheet'

type SheetName = 'analyze' | 'glucose' | 'hands' | 'state' | 'activity' | 'meds' | 'extras'

export function DayScreen() {
  const { settings, date, setDate, day, days, alerts } = useStore()
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)

  const label = relativeDayLabel(date)
  const isFuture = date > todayKey()
  const t = settings.profile.targets
  const dayMap = useMemo(() => asMap(days), [days])

  const carbs = useMemo(
    () => round(day.meals.reduce((a, m) => a + mealTotals(m).carbs, 0)),
    [day.meals],
  )
  const walkMinutes = day.activity.reduce((a, x) => a + x.minutes, 0)

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
        {/* Предупреждения стоят выше всего: их читают в момент, когда надо действовать. */}
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        <Card
          title="День"
          action={
            date !== todayKey() ? (
              <button className="btn sm ghost" onClick={() => setDate(todayKey())}>
                К сегодня
              </button>
            ) : undefined
          }
        >
          <div className="plate-row">
            <div className="plate-cell">
              <div className="v">{day.meals.length}</div>
              <div className="l">приёмов</div>
            </div>
            <div className="plate-cell">
              <div className="v">{carbs}</div>
              <div className="l">углеводов, г</div>
            </div>
            <div className={`plate-cell ${walkMinutes >= 30 ? 'good' : ''}`}>
              <div className="v">{walkMinutes}</div>
              <div className="l">мин движения</div>
            </div>
            <div className="plate-cell">
              <div className="v">{day.glucose.length}</div>
              <div className="l">замеров</div>
            </div>
          </div>
        </Card>

        <Card title="Еда">
          {day.meals.length === 0 ? (
            <div className="empty">Пока пусто. Сними тарелку — разбор придёт до того, как начнёшь есть.</div>
          ) : (
            day.meals.map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                date={date}
                onOpen={() => setEditingMeal(meal)}
                peakOk={t.peakOk}
                peakReview={t.peakReview}
                days={dayMap}
              />
            ))
          )}
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setSheet('analyze')}>
            📷 Добавить приём
          </button>
        </Card>

        <Card
          title="Сахар"
          action={
            <button className="btn sm ghost" onClick={() => setSheet('glucose')}>
              + Замер
            </button>
          }
        >
          {day.glucose.length === 0 ? (
            <div className="empty">Замеров нет</div>
          ) : (
            day.glucose.map((g) => {
              const hypo = g.mmol < t.hypo
              const high = g.mmol > t.dayHigh
              return (
                <div className="row" key={g.id}>
                  <div className="time">{g.time}</div>
                  <div className="main">
                    <div>{GLUCOSE_TAG_RU[g.tag]}</div>
                    {g.note && <div className="small muted">{g.note}</div>}
                  </div>
                  <div className={`chip ${hypo ? 'bad' : high ? 'warn' : 'good'}`}>{g.mmol.toFixed(1)}</div>
                </div>
              )
            })
          )}
          {day.cgm && (
            <div className="small muted" style={{ marginTop: 10 }}>
              Датчик за {day.cgm.periodDays} дн.: среднее {day.cgm.avgMmol}
              {day.cgm.eHbA1c != null && `, eHbA1c ${day.cgm.eHbA1c}%`}
              {day.cgm.timeInRangePct != null && `, в диапазоне ${day.cgm.timeInRangePct}%`}
              {day.cgm.timeVeryLowPct != null && `, очень низкий ${day.cgm.timeVeryLowPct}%`}
            </div>
          )}
        </Card>

        <Card
          title="Движение"
          action={
            <button className="btn sm ghost" onClick={() => setSheet('activity')}>
              + Прогулка
            </button>
          }
        >
          {day.activity.length === 0 ? (
            <div className="empty">Ничего не отмечено</div>
          ) : (
            day.activity.map((a) => {
              const meal = day.meals.find((m) => m.id === a.afterMealId)
              return (
                <div className="row" key={a.id}>
                  <div className="time">{a.time}</div>
                  <div className="main">
                    <div>
                      {ACTIVITY_KIND_RU[a.kind]} · {a.minutes} мин
                    </div>
                    {meal && <div className="small muted">после: {meal.title}</div>}
                  </div>
                </div>
              )
            })
          )}
        </Card>

        <Card
          title="Руки"
          action={
            <button className="btn sm ghost" onClick={() => setSheet('hands')}>
              {day.hands ? 'Изменить' : 'Отметить'}
            </button>
          }
        >
          {!day.hands ? (
            <div className="empty">Сегодня не отмечено. Это самый ценный раздел для невролога и МСЭ.</div>
          ) : (
            <>
              <div className="chips">
                <span className="chip key">онемение {day.hands.numbness}</span>
                <span className="chip key">жжение {day.hands.burning}</span>
                <span className="chip key">отёк {day.hands.swelling}</span>
                <span className={`chip ${day.hands.weakness >= 4 ? 'bad' : 'key'}`}>
                  слабость {day.hands.weakness}
                </span>
                {day.hands.droppedThings && <span className="chip bad">ронял предметы</span>}
              </div>
              {(day.hands.minutesToNumb != null || day.hands.minutesToRecover != null) && (
                <div className="small muted" style={{ marginTop: 8 }}>
                  {day.hands.minutesToNumb != null && `Затекает за ${day.hands.minutesToNumb} мин. `}
                  {day.hands.minutesToRecover != null && `Проходит за ${day.hands.minutesToRecover} мин.`}
                </div>
              )}
              {day.hands.triggers.length > 0 && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  Провоцировало: {day.hands.triggers.join(', ')}
                </div>
              )}
            </>
          )}
        </Card>

        <Card
          title="Состояние"
          action={
            <button className="btn sm ghost" onClick={() => setSheet('state')}>
              {day.state ? 'Изменить' : 'Отметить'}
            </button>
          }
        >
          {!day.state && !day.gut ? (
            <div className="empty">Не отмечено</div>
          ) : (
            <>
              {day.state && (
                <div className="chips">
                  <span className="chip key">тревога {day.state.anxiety}</span>
                  <span className="chip key">настроение {day.state.mood}</span>
                  {day.state.sleepHours != null && <span className="chip">сон {day.state.sleepHours} ч</span>}
                  {day.state.panicAttacks > 0 && <span className="chip warn">паник {day.state.panicAttacks}</span>}
                </div>
              )}
              {day.gut && (day.gut.nausea > 0 || day.gut.pain > 0 || day.gut.morningHungerPain) && (
                <div className="small muted" style={{ marginTop: 8 }}>
                  ЖКТ: тошнота {day.gut.nausea}, боли {day.gut.pain}, стул {STOOL_RU[day.gut.stool]}
                  {day.gut.morningHungerPain && ', голодные боли с утра'}
                </div>
              )}
              {day.weightKg != null && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  Вес {day.weightKg} кг{day.steps != null && `, шагов ${day.steps}`}
                </div>
              )}
              {day.notes && (
                <div className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {day.notes}
                </div>
              )}
            </>
          )}
        </Card>

        <Card
          title="Препараты"
          action={
            <button className="btn sm ghost" onClick={() => setSheet('meds')}>
              Отметить
            </button>
          }
        >
          {day.meds.length === 0 ? (
            <div className="empty">Не отмечено</div>
          ) : (
            day.meds.map((m) => (
              <div className="row" key={m.id}>
                <div className="time">{m.time}</div>
                <div className="main">
                  {m.name}
                  {m.dose && <span className="muted"> · {m.dose}</span>}
                </div>
                <div className={`chip ${m.taken ? 'good' : ''}`}>{m.taken ? 'принял' : '—'}</div>
              </div>
            ))
          )}
        </Card>

        {day.cravings.length > 0 && (
          <Card title="Тяга">
            {day.cravings.map((c) => (
              <div className="row" key={c.id}>
                <div className="time">{c.time}</div>
                <div className="main">
                  <div>{CRAVING_OUTCOME_RU[c.outcome]}</div>
                  {c.trigger && <div className="small muted">{c.trigger}</div>}
                </div>
                <div className="chip">{c.intensity}/10</div>
              </div>
            ))}
          </Card>
        )}

        <button className="btn ghost block" onClick={() => setSheet('extras')}>
          Алкоголь и сводка с датчика
        </button>
      </div>

      {sheet === 'analyze' && <AnalyzeSheet onClose={() => setSheet(null)} />}
      {sheet === 'glucose' && <GlucoseSheet onClose={() => setSheet(null)} />}
      {sheet === 'hands' && <HandsSheet onClose={() => setSheet(null)} />}
      {sheet === 'state' && <StateSheet onClose={() => setSheet(null)} />}
      {sheet === 'activity' && <ActivitySheet onClose={() => setSheet(null)} />}
      {sheet === 'meds' && <MedsSheet onClose={() => setSheet(null)} />}
      {sheet === 'extras' && <ExtrasSheet onClose={() => setSheet(null)} />}
      {editingMeal && <MealSheet meal={editingMeal} onClose={() => setEditingMeal(null)} />}
    </>
  )
}

function MealRow({
  meal,
  date,
  days,
  peakOk,
  peakReview,
  onOpen,
}: {
  meal: Meal
  date: string
  days: Map<string, import('../types').DayRecord>
  peakOk: number
  peakReview: number
  onOpen: () => void
}) {
  const response = mealResponse(days, date, meal)
  const peakClass =
    response.peak == null ? '' : response.peak >= peakReview ? 'bad' : response.peak > peakOk ? 'warn' : 'good'

  return (
    <div
      className="meal"
      style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
    >
      <div className="meal-head">
        {meal.photoId ? <PhotoThumb photoId={meal.photoId} /> : <div className="meal-thumb" />}
        <div className="t">
          <div className="name">{meal.title}</div>
          <div className="when">
            {meal.time}
            {/* Название по умолчанию равно виду приёма — не повторяем его дважды. */}
            {meal.title !== MEAL_KIND_RU[meal.kind] && ` · ${MEAL_KIND_RU[meal.kind]}`}
            {meal.plannedTreat && ' · запланировано'}
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="chip key">{plateSummary(meal.plate)}</span>
            {meal.verdict && (
              <span className={`chip ${meal.verdict.verdict === 'честно' ? 'good' : 'warn'}`}>
                {meal.verdict.verdict}
              </span>
            )}
            {meal.verdict?.isWin && <span className="chip good">★ победа</span>}
            {response.peak != null && (
              <span className={`chip ${peakClass}`}>
                пик {response.peak.toFixed(1)}
                {response.delta != null && ` (+${response.delta.toFixed(1)})`}
              </span>
            )}
            {response.walked && <span className="chip good">прогулка {response.walkMinutes} мин</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
