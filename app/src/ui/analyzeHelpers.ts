import type { MealAnalysis } from '../lib/ai'
import { analysisToItems, analysisToPlate } from '../lib/ai'
import type { FoodItem, MealKind, Plate } from '../types'

/** Ответ модели -> черновик приёма. Вынесено отдельно, чтобы тем же путём
 *  шли и разбор по фото, и разбор по описанию, и повторный пересчёт. */
export function analysisToMealDraft(analysis: MealAnalysis): {
  items: FoodItem[]
  plate: Plate
  title: string
  kind: MealKind
} {
  return {
    items: analysisToItems(analysis),
    plate: analysisToPlate(analysis),
    title: analysis.mealTitle,
    kind: analysis.mealKind,
  }
}
