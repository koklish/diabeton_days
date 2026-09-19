import type { DayRecord, FoodItem, Meal, Plate } from '../types'

/** Итоги приёма или дня. Калории здесь есть, но они не главный показатель:
 *  владельцу важна структура тарелки и углеводы, а не бухгалтерия до грамма. */
export interface Totals {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  /** Усвояемые углеводы = углеводы − клетчатка. Именно они двигают сахар. */
  netCarbs: number
  /** Гликемическая нагрузка: сумма ГИ × усвояемые углеводы / 100. */
  gl: number
  grams: number
}

export const ZERO_TOTALS: Totals = {
  kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, netCarbs: 0, gl: 0, grams: 0,
}

export function itemTotals(item: FoodItem): Totals {
  const k = item.grams / 100
  const carbs = item.per100.carbs * k
  const fiber = item.per100.fiber * k
  const netCarbs = Math.max(0, carbs - fiber)
  return {
    kcal: item.per100.kcal * k,
    protein: item.per100.protein * k,
    fat: item.per100.fat * k,
    carbs,
    fiber,
    netCarbs,
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
      gl: a.gl + t.gl,
      grams: a.grams + t.grams,
    }),
    { ...ZERO_TOTALS },
  )
}

export function mealTotals(meal: Meal): Totals {
  return sumTotals(meal.items.map(itemTotals))
}

export function dayTotals(day: DayRecord): Totals {
  return sumTotals(day.meals.map(mealTotals))
}

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
    gl: Math.round(t.gl),
    grams: Math.round(t.grams),
  }
}

/** Структура тарелки по составу — запасной путь, если модель её не вернула
 *  или человек правил состав руками. */
export function derivePlate(items: FoodItem[], previous?: Plate): Plate {
  const starches = items.filter((i) => i.role === 'starch').length
  const hasProtein = items.some((i) => i.role === 'protein')
  const hasSweet = items.some((i) => i.role === 'sweet')
  const vegGrams = items.filter((i) => i.role === 'vegetable').reduce((a, i) => a + i.grams, 0)
  // Напитки в долю тарелки не входят: стакан воды не делает половину овощей.
  const plateGrams = items.filter((i) => i.role !== 'drink').reduce((a, i) => a + i.grams, 0)
  const share = plateGrams > 0 ? vegGrams / plateGrams : 0
  const vegShare: Plate['vegShare'] =
    share >= 0.55 ? 'most' : share >= 0.4 ? 'half' : share > 0.05 ? 'some' : 'none'
  return { starches, hasProtein, vegShare, hasSweet, proteinFirst: previous?.proteinFirst ?? null }
}

/** Короткая строка о тарелке — то, что владелец читает вместо калорий. */
export function plateSummary(plate: Plate): string {
  const parts = [
    plate.starches === 0 ? 'без крахмала' : plate.starches === 1 ? '1 крахмал' : `${plate.starches} крахмала`,
    plate.hasProtein ? 'белок есть' : 'без белка',
    plate.vegShare === 'none'
      ? 'без овощей'
      : plate.vegShare === 'some'
        ? 'овощей мало'
        : plate.vegShare === 'half'
          ? 'овощи ½'
          : 'овощей больше половины',
  ]
  if (plate.hasSweet) parts.push('сладкое')
  return parts.join(' · ')
}
