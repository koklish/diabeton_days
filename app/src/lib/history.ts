import type { DayRecord, GlucoseReading, Meal } from '../types'
import { mealTotals, plateSummary, round } from './nutrition'
import { shiftDate } from './date'

/** Минуты от начала суток. Времена в записях — локальные «ЧЧ:ММ». */
export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export interface LinkedReading extends GlucoseReading {
  /** Дата записи, из которой замер: поздний ужин даёт «через 2 часа» уже назавтра. */
  date: string
  /** Минут после приёма пищи. */
  offsetMin: number
}

/** Замеры, относящиеся к приёму: сначала явно привязанные по mealId,
 *  иначе — попавшие в окно после еды. Поиск идёт и в следующие сутки,
 *  потому что ужин в 22:00 отзывается уже после полуночи. */
export function readingsForMeal(
  days: Map<string, DayRecord>,
  date: string,
  meal: Meal,
  windowMin = 240,
): LinkedReading[] {
  const start = minutes(meal.time)
  const out: LinkedReading[] = []
  for (const [dayOffset, key] of [[0, date], [1, shiftDate(date, 1)]] as const) {
    const day = days.get(key)
    if (!day) continue
    for (const r of day.glucose) {
      const offset = minutes(r.time) + dayOffset * 1440 - start
      if (r.mealId === meal.id) {
        out.push({ ...r, date: key, offsetMin: offset })
      } else if (!r.mealId && offset > 0 && offset <= windowMin) {
        out.push({ ...r, date: key, offsetMin: offset })
      }
    }
  }
  return out.sort((a, b) => a.offsetMin - b.offsetMin)
}

/** Замер непосредственно перед приёмом — точка отсчёта для подъёма. */
export function readingBeforeMeal(day: DayRecord, meal: Meal, windowMin = 60): GlucoseReading | null {
  const start = minutes(meal.time)
  const candidates = day.glucose
    .filter((r) => {
      const d = start - minutes(r.time)
      return d >= 0 && d <= windowMin
    })
    .sort((a, b) => minutes(b.time) - minutes(a.time))
  return candidates[0] ?? null
}

export interface MealResponse {
  date: string
  meal: Meal
  before: number | null
  /** Максимум из замеров после еды — то, что владелец называет пиком. */
  peak: number | null
  peakOffsetMin: number | null
  delta: number | null
  /** Была ли прогулка после этого приёма. */
  walked: boolean
  walkMinutes: number
}

export function mealResponse(days: Map<string, DayRecord>, date: string, meal: Meal): MealResponse {
  const day = days.get(date)
  const after = readingsForMeal(days, date, meal)
  const before = day ? (readingBeforeMeal(day, meal)?.mmol ?? null) : null
  let peak: number | null = null
  let peakOffsetMin: number | null = null
  for (const r of after) {
    if (peak == null || r.mmol > peak) {
      peak = r.mmol
      peakOffsetMin = r.offsetMin
    }
  }
  const walks = (day?.activity ?? []).filter((a) => {
    if (a.afterMealId === meal.id) return true
    if (a.afterMealId) return false
    const gap = minutes(a.time) - minutes(meal.time)
    return gap >= 0 && gap <= 120
  })
  return {
    date,
    meal,
    before,
    peak,
    peakOffsetMin,
    delta: before != null && peak != null ? round(peak - before, 1) : null,
    walked: walks.length > 0,
    walkMinutes: walks.reduce((a, w) => a + w.minutes, 0),
  }
}

export function asMap(days: DayRecord[]): Map<string, DayRecord> {
  return new Map(days.map((d) => [d.date, d]))
}

/** Все приёмы со связанным откликом сахара, новые первыми. */
export function allMealResponses(days: DayRecord[]): MealResponse[] {
  const map = asMap(days)
  const out: MealResponse[] = []
  for (const day of days) {
    for (const meal of day.meals) out.push(mealResponse(map, day.date, meal))
  }
  return out.sort((a, b) => (b.date + b.meal.time).localeCompare(a.date + a.meal.time))
}

/** Компактная история для промпта: чем она короче, тем внимательнее модель
 *  к тому, что в ней есть. Берём только приёмы, у которых есть отклик сахара. */
export function historyForPrompt(days: DayRecord[], limit = 25): string {
  const withResponse = allMealResponses(days).filter((r) => r.peak != null)
  if (withResponse.length === 0) return ''
  const lines = withResponse.slice(0, limit).map((r) => {
    const t = mealTotals(r.meal)
    const items = r.meal.items.map((i) => `${i.name} ${i.portion || Math.round(i.grams) + ' г'}`).join(', ')
    const sugar =
      r.before != null
        ? `${r.before} → ${r.peak} (+${r.delta}) через ${r.peakOffsetMin} мин`
        : `${r.peak} через ${r.peakOffsetMin} мин`
    const walk = r.walked ? `, прогулка ${r.walkMinutes} мин` : ', без прогулки'
    return `${r.date} ${r.meal.time} — ${items || r.meal.title}. ${plateSummary(r.meal.plate)}, углеводы ~${round(t.carbs)} г${walk}. Сахар: ${sugar}.`
  })
  return lines.join('\n')
}
