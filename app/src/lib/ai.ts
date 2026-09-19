import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod/v4'
import type { FoodItem, Settings } from '../types'
import { uid } from './date'

/** Схема ответа модели. Всё поля обязательные и без optional: строгий JSON-Schema
 *  не любит необязательные ключи, а «нет значения» выражаем через null. */
const Per100Schema = z.object({
  kcal: z.number().describe('Килокалории на 100 г готового блюда'),
  protein: z.number().describe('Белки, г на 100 г'),
  fat: z.number().describe('Жиры, г на 100 г'),
  carbs: z.number().describe('Углеводы всего, г на 100 г (включая клетчатку)'),
  fiber: z.number().describe('Пищевые волокна, г на 100 г'),
})

const DishSchema = z.object({
  name: z.string().describe('Короткое название блюда по-русски'),
  detail: z.string().describe('Что именно видно: состав, способ приготовления, видимое масло/соус'),
  grams: z.number().describe('Наиболее вероятный вес съедобной части порции, г'),
  gramsMin: z.number().describe('Нижняя граница правдоподобного веса, г'),
  gramsMax: z.number().describe('Верхняя граница правдоподобного веса, г'),
  per100: Per100Schema,
  gi: z.number().nullable().describe('Гликемический индекс 0-110; null для блюд почти без углеводов'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Уверенность в оценке именно этого блюда'),
  assumption: z.string().describe('На чём основана оценка веса: посуда, ориентиры, стандартная порция'),
})

const MealAnalysisSchema = z.object({
  mealTitle: z.string().describe('Название приёма пищи одной строкой, например «Гречка с курицей и салат»'),
  mealKind: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  dishes: z.array(DishSchema),
  overallConfidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()).describe('Что мешает точной оценке: ракурс, скрытые слои, неизвестный соус'),
  diabetesNote: z
    .string()
    .describe('2-4 предложения: как этот приём скажется на глюкозе и что можно поправить'),
  questions: z
    .array(z.string())
    .describe('Уточняющие вопросы, ответы на которые заметно повысят точность. Не больше трёх'),
})

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>

const SYSTEM = `Ты — клинический нутрициолог, который помогает человеку с сахарным диабетом 2 типа вести дневник питания по фотографиям.

Задача: по фото определить состав приёма пищи, оценить вес каждой позиции и дать пищевую ценность НА 100 Г готового блюда. Абсолютные значения порции приложение посчитает само — тебе нужны только вес и значения на 100 г.

Как оценивать вес:
- Опирайся на видимые ориентиры масштаба: диаметр тарелки (обычная обеденная ≈ 24-27 см, десертная ≈ 19-20 см), столовый прибор (вилка ≈ 19 см, чайная ложка ≈ 14 см), стакан (200-250 мл), кружка (250-350 мл), рука, упаковка.
- Учитывай высоту горки, а не только площадь: плоско размазанная порция и горка одного диаметра различаются вдвое.
- Считай съедобную часть: без костей, кожуры, косточек, панциря.
- Указывай gramsMin и gramsMax как честный диапазон. Если ракурс не даёт судить о высоте, диапазон должен быть широким, а confidence — low.
- Не занижай оценку из вежливости. Систематическое занижение углеводов для диабетика опаснее, чем завышение.

Как оценивать состав:
- Разбивай на отдельные позиции всё, что различается по углеводам: гарнир, белковая часть, овощи, хлеб, соус, напиток, масло для жарки.
- Видимое масло и заправка — отдельная позиция или явная надбавка к жирам блюда: их регулярно забывают, а на калорийность они влияют сильно.
- Для углеводных блюд указывай гликемический индекс готового продукта. Помни, что степень разваренности и обработка меняют ГИ: паста аль денте ≈ 45, переваренная ≈ 65; картофельное пюре ≈ 85, отварной молодой картофель ≈ 60.
- Значения на 100 г бери для ГОТОВОГО блюда, а не для сухой крупы: сухая гречка ≈ 340 ккал/100 г, отварная ≈ 100-110 ккал/100 г. Это самая частая ошибка — проверь себя.
- Клетчатку указывай честно, включая её в общие углеводы.

diabetesNote: коротко и по делу — как приём повлияет на глюкозу через 1-2 часа, что в нём главный источник углеводов, какая замена или добавка (белок, клетчатка, порядок еды) сгладила бы подъём. Без общих советов вроде «питайтесь сбалансированно». Не назначай и не меняй дозы препаратов — это дело врача.

questions: только то, что реально меняет цифры (чем заправлено, сколько сахара в напитке, какой хлеб). Если фото достаточно — пустой список.`

function buildClient(settings: Settings): Anthropic {
  const key = settings.anthropicApiKey.trim()
  if (!key) throw new AiError('no-key', 'Не задан ключ Anthropic API. Откройте «Настройки».')
  return new Anthropic({
    apiKey: key,
    // Ключ лежит на устройстве пользователя и уходит только в api.anthropic.com.
    // Это личное приложение: отдельного сервера-прокси нет.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  })
}

export class AiError extends Error {
  constructor(
    readonly kind: 'no-key' | 'auth' | 'rate-limit' | 'refusal' | 'network' | 'parse' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError('auth', 'Ключ Anthropic API отклонён. Проверьте его в настройках.')
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', 'У ключа нет доступа к этой модели. Проверьте тариф и настройки ключа.')
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError('rate-limit', 'Слишком много запросов подряд. Подождите минуту и повторите.')
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError('network', 'Нет связи с api.anthropic.com. Проверьте интернет.')
  }
  if (err instanceof Anthropic.APIError) {
    return new AiError('unknown', `Ошибка API: ${err.message}`)
  }
  return new AiError('unknown', err instanceof Error ? err.message : String(err))
}

export interface AnalyzeInput {
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Подсказка пользователя: «хлеб два куска», «чай без сахара». */
  hint?: string
  time: string
  settings: Settings
}

export async function analyzeMealPhoto(input: AnalyzeInput): Promise<MealAnalysis> {
  const { settings } = input
  const client = buildClient(settings)

  const context = [
    `Время приёма пищи: ${input.time}.`,
    settings.healthContext.trim() && `О человеке: ${settings.healthContext.trim()}`,
    settings.xeUseNetCarbs
      ? `Хлебные единицы пользователь считает по усвояемым углеводам, 1 ХЕ = ${settings.xeGrams} г.`
      : `Хлебные единицы пользователь считает по общим углеводам, 1 ХЕ = ${settings.xeGrams} г.`,
    input.hint?.trim() && `Уточнение от пользователя (оно важнее твоей догадки по фото): ${input.hint.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const response = await client.beta.messages.parse({
      model: settings.model,
      max_tokens: 16000,
      system: SYSTEM,
      // Серверный фолбэк: если запрос попадёт под классификатор отказа,
      // ответ придёт от запасной модели, а не ошибкой в лицо пользователю.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: settings.effort,
        format: zodOutputFormat(MealAnalysisSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 } },
            { type: 'text', text: `${context}\n\nПроанализируй этот приём пищи.` },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      throw new AiError('refusal', 'Модель отказалась разбирать это изображение. Попробуйте другое фото.')
    }
    const parsed = response.parsed_output
    if (!parsed) {
      throw new AiError('parse', 'Модель вернула ответ в неожиданном формате. Повторите попытку.')
    }
    return parsed
  } catch (err) {
    throw toAiError(err)
  }
}

/** Ответ модели -> позиции дневника. Отрицательные и нечисловые значения
 *  отсекаем здесь: ниже по коду они превратились бы в NaN в итогах. */
export function analysisToItems(analysis: MealAnalysis): FoodItem[] {
  return analysis.dishes.map((d) => ({
    id: uid(),
    name: d.name,
    grams: safe(d.grams, 0),
    gramsMin: safe(d.gramsMin, 0),
    gramsMax: safe(d.gramsMax, 0),
    per100: {
      kcal: safe(d.per100.kcal, 0),
      protein: safe(d.per100.protein, 0),
      fat: safe(d.per100.fat, 0),
      carbs: safe(d.per100.carbs, 0),
      fiber: safe(d.per100.fiber, 0),
    },
    gi: d.gi == null || !Number.isFinite(d.gi) ? null : clamp(d.gi, 0, 110),
    confidence: d.confidence,
    assumption: [d.detail, d.assumption].filter(Boolean).join(' — ') || undefined,
  }))
}


function safe(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Короткая проверка ключа из настроек, чтобы не выяснять это в момент съёмки. */
export async function testApiKey(settings: Settings): Promise<string> {
  const client = buildClient(settings)
  try {
    const res = await client.messages.create({
      model: settings.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Ответь одним словом: готов' }],
    })
    const text = res.content.find((b) => b.type === 'text')
    return text && text.type === 'text' ? text.text.trim() : 'ок'
  } catch (err) {
    throw toAiError(err)
  }
}
