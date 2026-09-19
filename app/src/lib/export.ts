import type { DayRecord, Settings } from '../types'
import { dayTotals, itemTotals, mealTotals, roundTotals } from './nutrition'
import { MEAL_KIND_RU, GLUCOSE_TAG_RU } from '../types'

/** Формат, который уезжает в репозиторий. Отличается от внутреннего тем,
 *  что итоги уже посчитаны: файл должен быть самодостаточным для чтения
 *  человеком и Claude, без запуска кода приложения. */
export function toExportJson(day: DayRecord, settings: Settings) {
  return {
    schemaVersion: day.schemaVersion,
    date: day.date,
    updatedAt: day.updatedAt,
    xe: {
      gramsPerUnit: settings.xeGrams,
      basis: settings.xeUseNetCarbs ? 'net_carbs' : 'total_carbs',
    },
    targets: {
      kcal: settings.targetKcal,
      carbs: settings.targetCarbs,
      glucoseLow: settings.glucoseLow,
      glucoseHigh: settings.glucoseHigh,
    },
    totals: roundTotals(dayTotals(day, settings)),
    meals: day.meals.map((meal) => ({
      time: meal.time,
      kind: meal.kind,
      kindRu: MEAL_KIND_RU[meal.kind],
      title: meal.title,
      source: meal.source,
      model: meal.model ?? null,
      editedByUser: meal.editedByUser,
      photo: meal.photoId ? `photos/${day.date}/${meal.photoId}.jpg` : null,
      note: meal.note ?? null,
      totals: roundTotals(mealTotals(meal, settings)),
      items: meal.items.map((item) => ({
        name: item.name,
        grams: Math.round(item.grams),
        gramsRange:
          item.gramsMin != null && item.gramsMax != null
            ? [Math.round(item.gramsMin), Math.round(item.gramsMax)]
            : null,
        per100: item.per100,
        gi: item.gi,
        confidence: item.confidence,
        assumption: item.assumption ?? null,
        totals: roundTotals(itemTotals(item, settings)),
      })),
    })),
    glucose: day.glucose.map((g) => ({
      time: g.time,
      mmol: g.mmol,
      tag: g.tag,
      tagRu: GLUCOSE_TAG_RU[g.tag],
      inRange: g.mmol >= settings.glucoseLow && g.mmol <= settings.glucoseHigh,
      note: g.note ?? null,
    })),
    meds: day.meds.map((m) => ({ time: m.time, name: m.name, dose: m.dose ?? null, taken: m.taken })),
    weightKg: day.weightKg ?? null,
    steps: day.steps ?? null,
    notes: day.notes ?? null,
  }
}

export interface IndexRow {
  date: string
  kcal: number
  carbs: number
  xe: number
  meals: number
  glucoseMin: number | null
  glucoseMax: number | null
  glucoseAvg: number | null
  updatedAt: string
}

export function toIndexRow(day: DayRecord, settings: Settings): IndexRow {
  const t = roundTotals(dayTotals(day, settings))
  const values = day.glucose.map((g) => g.mmol).filter((v) => Number.isFinite(v))
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  return {
    date: day.date,
    kcal: t.kcal,
    carbs: t.carbs,
    xe: t.xe,
    meals: day.meals.length,
    glucoseMin: values.length ? Math.min(...values) : null,
    glucoseMax: values.length ? Math.max(...values) : null,
    glucoseAvg: avg == null ? null : Math.round(avg * 10) / 10,
    updatedAt: day.updatedAt,
  }
}
