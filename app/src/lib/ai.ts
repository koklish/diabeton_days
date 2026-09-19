import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import * as z from 'zod/v4'
import type { DayRecord, FoodItem, MealVerdict, Plate, Settings } from '../types'
import { isLateWindow, isMorningWindow, profileToPrompt } from '../profile'
import { uid } from './date'
import { historyForPrompt } from './history'

const Per100Schema = z.object({
  kcal: z.number().describe('Ккал на 100 г готового блюда'),
  protein: z.number().describe('Белки, г на 100 г'),
  fat: z.number().describe('Жиры, г на 100 г'),
  carbs: z.number().describe('Углеводы всего, г на 100 г, включая клетчатку'),
  fiber: z.number().describe('Пищевые волокна, г на 100 г'),
})

const DishSchema = z.object({
  name: z.string().describe('Короткое название по-русски'),
  role: z
    .enum(['protein', 'starch', 'vegetable', 'fruit', 'fat', 'sweet', 'nuts', 'drink'])
    .describe('Роль в тарелке. Именно она решает, как приём повлияет на сахар'),
  portion: z.string().describe('Бытовое описание порции: «с кулак», «две столовые ложки», «половина тарелки»'),
  grams: z.number().describe('Примерный вес съедобной части, г'),
  gramsMin: z.number().describe('Нижняя граница правдоподобного веса, г'),
  gramsMax: z.number().describe('Верхняя граница правдоподобного веса, г'),
  per100: Per100Schema,
  gi: z.number().nullable().describe('Гликемический индекс 0–110; null, если углеводов почти нет'),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().describe('Что именно видно: способ приготовления, видимое масло, соус. Пусто — пустая строка'),
})

const PlateSchema = z.object({
  starches: z.number().describe('Сколько разных крахмалов в приёме'),
  hasProtein: z.boolean(),
  vegShare: z.enum(['none', 'some', 'half', 'most']).describe('Доля овощей в тарелке'),
  hasSweet: z.boolean(),
  proteinFirst: z.boolean().nullable().describe('Виден ли порядок «белок → овощи → гарнир». null, если по фото не видно'),
})

const AnalysisSchema = z.object({
  mealTitle: z.string().describe('Название приёма одной строкой'),
  mealKind: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  dishes: z.array(DishSchema),
  plate: PlateSchema,
  explanation: z.string().describe('Одно-два предложения: почему сахар пойдёт так, а не иначе'),
  expectedCurve: z.string().describe('Одна строка: как поведёт себя сахар по времени. Без выдуманной точности'),
  verdict: z.enum(['честно', 'не честно']),
  verdictReason: z.string().describe('Одна короткая строка: почему такой вердикт'),
  isWin: z.boolean().describe('true, если это не просто нормально, а победа, которую стоит назвать вслух'),
  wins: z.array(z.string()).describe('Что засчитать в плюс. Пустой список, если правда не за что'),
  fix: z.string().nullable().describe('Одно конкретное действие, которое ещё можно сделать. null, если не нужно'),
  warnings: z.array(z.string()).describe('Что мешает точной оценке или на что стоит обратить внимание'),
  questions: z.array(z.string()).describe('Не больше трёх уточнений, которые реально изменят цифры'),
  basedOnPastMeals: z
    .array(z.string())
    .describe('Ссылки на похожие приёмы из истории в формате «2026-09-14 08:30 → 7,3». Пусто, если истории нет'),
})

export type MealAnalysis = z.infer<typeof AnalysisSchema>

const SYSTEM = `Ты помогаешь человеку с диабетом 2 типа разбирать приёмы пищи по фотографии. Разбор нужен ДО еды: он смотрит его, пока тарелка ещё перед ним, и успевает что-то изменить.

# Как писать

Коротко. Без преамбул, без «отличный выбор!», без восклицательных знаков, без нотаций и без морали. Обращайся на «ты».

Честно в обе стороны. Если два крахмала — скажи прямо и сразу. Если приём поздний — напомни, что ночью он не сгорит, человек будет лежать, а не двигаться. Но если приём хороший — назови это вслух: видимый прогресс держит его на плаву сильнее, чем список ошибок. Собрал три тарелки без крахмала в буфете «всё включено» — это победа, а не «ну ладно».

Никогда не пиши «нельзя», «вы нарушили», «норма превышена». Вместо запрета — как это сработает и какая будет цифра. Вина его ломает, а не выпрямляет: у него зависимость в анамнезе и нелеченая до конца депрессия.

Не назначай, не отменяй и не меняй дозы препаратов. Максимум — «это вопрос к эндокринологу».

# Что оценивать

Не бухгалтерию калорий, а структуру тарелки: сколько крахмалов, есть ли белок, какая доля овощей, есть ли сладкое. Вес оценивай бытовыми мерками — «с кулак», «две столовые ложки». Точность до грамма всё равно иллюзорна, а давление от неё реальное.

Значения per100 давай для ГОТОВОГО блюда, не для сухого продукта: сухая гречка ≈ 340 ккал/100 г, отварная ≈ 110. Это самая частая ошибка — проверь себя.

Роли: крахмал — гречка, рис, картофель, хлеб, макароны, бобовые. Овощи — некрахмалистые. Орехи и фрукты отдельными ролями: они ведут себя по-разному. Видимое масло и заправку не пропускай.

Опирайся на ориентиры масштаба: обеденная тарелка ≈ 24–27 см, десертная ≈ 19–20 см, вилка ≈ 19 см, стакан 200–250 мл. Учитывай высоту горки, а не только площадь. Если ракурс не даёт судить — ставь confidence low и широкий диапазон веса. Занижать углеводы опаснее, чем завысить.

# Вердикт

Ровно два значения: «честно» или «не честно». Это про соответствие его собственным правилам, а не про мораль. Нюансы — в explanation, одной-двумя фразами.

isWin ставь только тогда, когда это правда достижение, а не просто отсутствие ошибок.

fix — одно конкретное действие, которое он ещё успевает сделать: отложить половину гарнира, начать с белка, пройтись 20 минут после. Не список. Если делать нечего — null.

# История

Если в контексте есть его прошлые приёмы с цифрами сахара — используй их. «В прошлые три раза такое сочетание давало тебе 7,5» полезнее любой теории. Ссылки на такие приёмы клади в basedOnPastMeals. Если похожих нет — не выдумывай.`

function buildClient(settings: Settings): Anthropic {
  const key = settings.anthropicApiKey.trim()
  if (!key) throw new AiError('no-key', 'Не задан ключ Anthropic API. Открой «Настройки».')
  return new Anthropic({
    apiKey: key,
    // Ключ лежит на устройстве и уходит только в api.anthropic.com:
    // отдельного сервера у приложения нет.
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
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError('auth', 'Ключ Anthropic API отклонён. Проверь его в настройках.')
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError('auth', 'У ключа нет доступа к этой модели. Проверь тариф.')
  if (err instanceof Anthropic.RateLimitError)
    return new AiError('rate-limit', 'Слишком много запросов подряд. Подожди минуту.')
  if (err instanceof Anthropic.APIConnectionError)
    return new AiError('network', 'Нет связи с api.anthropic.com. Проверь интернет.')
  if (err instanceof Anthropic.APIError) return new AiError('unknown', `Ошибка API: ${err.message}`)
  return new AiError('unknown', err instanceof Error ? err.message : String(err))
}

export interface AnalyzeInput {
  imageBase64?: string
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Описание словами — когда фото нет или его мало. */
  description?: string
  /** Уточнение от человека: оно важнее догадки модели. */
  hint?: string
  time: string
  settings: Settings
  /** Недавние дни — источник личных закономерностей. */
  history: DayRecord[]
  /** Последний известный сахар, если он есть: разбор без него слеп. */
  currentGlucose?: number | null
  plannedTreat?: boolean
}

export async function analyzeMeal(input: AnalyzeInput): Promise<MealAnalysis> {
  const { settings } = input
  const client = buildClient(settings)
  const profile = settings.profile

  const context = [
    profileToPrompt(profile),
    '',
    `Время приёма: ${input.time}.`,
    isMorningWindow(input.time)
      ? 'Это утро — работает феномен зари, крахмал здесь бьёт сильнее обычного.'
      : null,
    isLateWindow(input.time)
      ? 'Это поздний приём: после 20:00 его правило — только белок, и ночью съеденное не сгорит.'
      : null,
    input.currentGlucose != null ? `Сахар перед приёмом: ${input.currentGlucose} ммоль/л.` : null,
    input.plannedTreat
      ? 'Это запланированный чит-приём. Он часть системы, а не нарушение: разбирай спокойно, ' +
        'скажи, как пойдёт сахар и что поможет сгладить, но не осуждай сам факт.'
      : null,
    input.description?.trim() ? `Описание словами: ${input.description.trim()}` : null,
    input.hint?.trim() ? `Уточнение (важнее твоей догадки по фото): ${input.hint.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const history = historyForPrompt(input.history)
  const historyBlock = history ? `\n\n# Его прошлые приёмы и как на них отзывался сахар\n\n${history}` : ''

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.imageBase64 && input.mediaType) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: input.mediaType, data: input.imageBase64 },
    })
  }
  content.push({ type: 'text', text: `${context}${historyBlock}\n\nРазбери этот приём.` })

  try {
    const response = await client.beta.messages.parse({
      model: settings.model,
      max_tokens: 16000,
      system: SYSTEM,
      // Серверный фолбэк: если запрос попадёт под классификатор отказа,
      // ответ придёт от запасной модели, а не ошибкой в момент, когда еда остывает.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: settings.effort, format: zodOutputFormat(AnalysisSchema) },
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal') {
      throw new AiError('refusal', 'Модель не стала разбирать это изображение. Попробуй другое фото.')
    }
    const parsed = response.parsed_output
    if (!parsed) throw new AiError('parse', 'Ответ пришёл в неожиданном формате. Повтори попытку.')
    return parsed
  } catch (err) {
    throw toAiError(err)
  }
}

export function analysisToItems(analysis: MealAnalysis): FoodItem[] {
  return analysis.dishes.map((d) => ({
    id: uid(),
    name: d.name,
    role: d.role,
    portion: d.portion,
    grams: safe(d.grams),
    gramsMin: safe(d.gramsMin),
    gramsMax: safe(d.gramsMax),
    per100: {
      kcal: safe(d.per100.kcal),
      protein: safe(d.per100.protein),
      fat: safe(d.per100.fat),
      carbs: safe(d.per100.carbs),
      fiber: safe(d.per100.fiber),
    },
    gi: d.gi == null || !Number.isFinite(d.gi) ? null : clamp(d.gi, 0, 110),
    confidence: d.confidence,
    note: d.note?.trim() || undefined,
  }))
}

export function analysisToPlate(analysis: MealAnalysis): Plate {
  return {
    starches: Math.max(0, Math.round(analysis.plate.starches)),
    hasProtein: analysis.plate.hasProtein,
    vegShare: analysis.plate.vegShare,
    hasSweet: analysis.plate.hasSweet,
    proteinFirst: analysis.plate.proteinFirst,
  }
}

export function analysisToVerdict(analysis: MealAnalysis): MealVerdict {
  return {
    verdict: analysis.verdict,
    isWin: analysis.isWin,
    verdictReason: analysis.verdictReason,
    explanation: analysis.explanation,
    wins: analysis.wins,
    fix: analysis.fix,
    warnings: analysis.warnings,
    questions: analysis.questions,
    expectedCurve: analysis.expectedCurve,
    basedOnPastMeals: analysis.basedOnPastMeals,
  }
}

function safe(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

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
