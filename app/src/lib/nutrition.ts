import type { DayRecord, FoodItem, Meal, Settings } from '../types'

export interface Totals {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  /** Усвояемые углеводы = углеводы − клетчатка, но не меньше нуля. */
  netCarbs: number
  xe: number
  /** Гликемическая нагрузка: сумма ГИ × усвояемые углеводы / 100. */
  gl: number
  grams: number
}

export const ZERO_TOTALS: Totals = {
  kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, netCarbs: 0, xe: 0, gl: 0, grams: 0,
}

/** Абсолютные значения для порции: значения на 100 г, масштабированные на вес. */
export function itemTotals(item: FoodItem, settings: Settings): Totals {
  const k = item.grams / 100
  const carbs = item.per100.carbs * k
  const fiber = item.per100.fiber * k
  const netCarbs = Math.max(0, carbs - fiber)
  const xeBase = settings.xeUseNetCarbs ? netCarbs : carbs
  return {
    kcal: item.per100.kcal * k,
    protein: item.per100.protein * k,
    fat: item.per100.fat * k,
    carbs,
    fiber,
    netCarbs,
    xe: xeBase / (settings.xeGrams || 12),
    gl: item.gi == null ? 0 : (item.gi * netCarbs) / 100,
    grams: item.grams,
  }
}

export function sumTotals(list: Totals[]): Totals {
  return list.reduce<Totals>(
    (a, t) => ({
      kcal: a.kcal + t.kcal,
      protein: a.protein + t.protein,
      fat: a.fat + t.fat,
      carbs: a.carbs + t.carbs,
      fiber: a.fiber + t.fiber,
      netCarbs: a.netCarbs + t.netCarbs,
      xe: a.xe + t.xe,
      gl: a.gl + t.gl,
      grams: a.grams + t.grams,
    }),
    { ...ZERO_TOTALS },
  )
}

export function mealTotals(meal: Meal, settings: Settings): Totals {
  return sumTotals(meal.items.map((i) => itemTotals(i, settings)))
}

export function dayTotals(day: DayRecord, settings: Settings): Totals {
  return sumTotals(day.meals.map((m) => mealTotals(m, settings)))
}

/** Округление для показа и для выгрузки: цифры с четырьмя знаками только шумят. */
export function round(value: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function roundTotals(t: Totals): Totals {
  return {
    kcal: Math.round(t.kcal),
    protein: round(t.protein),
    fat: round(t.fat),
    carbs: round(t.carbs),
    fiber: round(t.fiber),
    netCarbs: round(t.netCarbs),
    xe: round(t.xe, 2),
    gl: round(t.gl),
    grams: Math.round(t.grams),
  }
}
