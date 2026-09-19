import type { DayRecord, Settings } from '../types'
import {
  ACTIVITY_KIND_RU,
  CRAVING_OUTCOME_RU,
  FOOD_ROLE_RU,
  GLUCOSE_TAG_RU,
  MEAL_KIND_RU,
  STOOL_RU,
  VEG_SHARE_RU,
} from '../types'
import { dayTotals, itemTotals, mealTotals, plateSummary, roundTotals } from './nutrition'
import { asMap, mealResponse } from './history'

/** Формат, который уезжает в реестр. Отличается от внутреннего тем, что связи
 *  уже разобраны: приём знает свой отклик сахара, цифры посчитаны, коды
 *  продублированы по-русски. Файл должен читаться врачом с телефона и Claude —
 *  без запуска кода приложения. */
export function toExportJson(day: DayRecord, settings: Settings, context: DayRecord[] = [day]) {
  const map = asMap(context.some((d) => d.date === day.date) ? context : [...context, day])
  const t = settings.profile.targets

  return {
    schemaVersion: day.schemaVersion,
    date: day.date,
    updatedAt: day.updatedAt,
    targets: {
      dayRange: [t.dayLow, t.dayHigh],
      fastingHigh: t.fastingHigh,
      fastingBest: [t.fastingBestLow, t.fastingBestHigh],
      peakOk: t.peakOk,
      peakReview: t.peakReview,
      hypo: t.hypo,
    },
    totals: roundTotals(dayTotals(day)),
    meals: day.meals.map((meal) => {
      const response = mealResponse(map, day.date, meal)
      return {
        id: meal.id,
        time: meal.time,
        kind: meal.kind,
        kindRu: MEAL_KIND_RU[meal.kind],
        title: meal.title,
        plannedTreat: meal.plannedTreat,
        source: meal.source,
        model: meal.model ?? null,
        editedByUser: meal.editedByUser,
        photo: meal.photoId ? `photos/${day.date}/${meal.photoId}.jpg` : null,
        note: meal.note ?? null,
        plate: {
          ...meal.plate,
          vegShareRu: VEG_SHARE_RU[meal.plate.vegShare],
          summary: plateSummary(meal.plate),
        },
        totals: roundTotals(mealTotals(meal)),
        // Отклик сахара на этот приём — то, ради чего дневник и ведётся.
        response: {
          before: response.before,
          peak: response.peak,
          peakOffsetMin: response.peakOffsetMin,
          delta: response.delta,
          walked: response.walked,
          walkMinutes: response.walkMinutes,
        },
        verdict: meal.verdict ?? null,
        items: meal.items.map((item) => ({
          name: item.name,
          role: item.role,
          roleRu: FOOD_ROLE_RU[item.role],
          portion: item.portion,
          grams: Math.round(item.grams),
          gramsRange:
            item.gramsMin != null && item.gramsMax != null
              ? [Math.round(item.gramsMin), Math.round(item.gramsMax)]
              : null,
          per100: item.per100,
          gi: item.gi,
          confidence: item.confidence,
          note: item.note ?? null,
          totals: roundTotals(itemTotals(item)),
        })),
      }
    }),
    glucose: day.glucose.map((g) => ({
      time: g.time,
      mmol: g.mmol,
      tag: g.tag,
      tagRu: GLUCOSE_TAG_RU[g.tag],
      source: g.source,
      mealId: g.mealId ?? null,
      isHypo: g.mmol < t.hypo,
      inDayRange: g.mmol >= t.dayLow && g.mmol <= t.dayHigh,
      note: g.note ?? null,
    })),
    cgm: day.cgm ?? null,
    activity: day.activity.map((a) => ({
      time: a.time,
      kind: a.kind,
      kindRu: ACTIVITY_KIND_RU[a.kind],
      minutes: a.minutes,
      afterMealId: a.afterMealId ?? null,
      note: a.note ?? null,
    })),
    meds: day.meds.map((m) => ({
      time: m.time,
      name: m.name,
      dose: m.dose ?? null,
      kind: m.kind,
      taken: m.taken,
      note: m.note ?? null,
    })),
    alcohol: day.alcohol.map((a) => ({ time: a.time, drink: a.drink, units: a.units, note: a.note ?? null })),
    hands: day.hands ?? null,
    state: day.state ?? null,
    gut: day.gut
      ? { ...day.gut, stoolRu: STOOL_RU[day.gut.stool] }
      : null,
    cravings: day.cravings.map((c) => ({
      time: c.time,
      intensity: c.intensity,
      trigger: c.trigger ?? null,
      outcome: c.outcome,
      outcomeRu: CRAVING_OUTCOME_RU[c.outcome],
      minutes: c.minutes ?? null,
      glucoseAtStart: c.glucoseAtStart ?? null,
      note: c.note ?? null,
    })),
    weightKg: day.weightKg ?? null,
    steps: day.steps ?? null,
    notes: day.notes ?? null,
  }
}

export interface IndexRow {
  date: string
  meals: number
  carbs: number
  starchesMax: number
  glucoseMin: number | null
  glucoseMax: number | null
  glucoseAvg: number | null
  hypoCount: number
  walkMinutes: number
  handsWorst: number | null
  anxiety: number | null
  weightKg: number | null
  cravings: number
  updatedAt: string
}

export function toIndexRow(day: DayRecord, settings: Settings): IndexRow {
  const t = roundTotals(dayTotals(day))
  const values = day.glucose.map((g) => g.mmol).filter((v) => Number.isFinite(v))
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const hands = day.hands
  return {
    date: day.date,
    meals: day.meals.length,
    carbs: t.carbs,
    starchesMax: day.meals.reduce((a, m) => Math.max(a, m.plate.starches), 0),
    glucoseMin: values.length ? Math.min(...values) : null,
    glucoseMax: values.length ? Math.max(...values) : null,
    glucoseAvg: avg == null ? null : Math.round(avg * 10) / 10,
    hypoCount: day.glucose.filter((g) => g.mmol < settings.profile.targets.hypo).length,
    walkMinutes: day.activity.reduce((a, x) => a + x.minutes, 0),
    handsWorst: hands
      ? Math.max(hands.numbness, hands.burning, hands.swelling, hands.weakness)
      : null,
    anxiety: day.state?.anxiety ?? null,
    weightKg: day.weightKg ?? null,
    cravings: day.cravings.length,
    updatedAt: day.updatedAt,
  }
}
