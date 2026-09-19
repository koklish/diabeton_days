// Модель данных дневника. Одна запись = одни сутки, внутри все приёмы пищи.
// Всё, что попадает сюда, уезжает в репозиторий как days/YYYY-MM-DD.json,
// поэтому имена полей стабильные: их читают и человек, и Claude.

export const SCHEMA_VERSION = 2

export type Confidence = 'high' | 'medium' | 'low'

export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_KIND_RU: Record<MealKind, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

/** Пищевая ценность на 100 г продукта — то, что оценивает ИИ. */
export interface Per100 {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
}

/** Одно блюдо/продукт внутри приёма пищи. */
export interface FoodItem {
  id: string
  name: string
  grams: number
  /** Диапазон правдоподобного веса, г — чтобы видеть разброс оценки. */
  gramsMin?: number
  gramsMax?: number
  per100: Per100
  /** Гликемический индекс, 0–110. null — неизвестен/неприменим. */
  gi: number | null
  confidence: Confidence
  /** На каких допущениях ИИ считал вес (посуда, размер порции). */
  assumption?: string
}

export interface Meal {
  id: string
  /** Локальное время приёма, "HH:MM". */
  time: string
  kind: MealKind
  title: string
  /** Ключ фото в локальной базе (IndexedDB). В JSON уезжает только имя файла. */
  photoId?: string
  items: FoodItem[]
  note?: string
  source: 'ai' | 'manual'
  model?: string
  /** true, если пользователь правил цифры после ИИ. */
  editedByUser: boolean
  createdAt: string
}

export type GlucoseTag =
  | 'fasting'
  | 'before_meal'
  | 'post1h'
  | 'post2h'
  | 'bedtime'
  | 'random'
  | 'hypo'

export const GLUCOSE_TAG_RU: Record<GlucoseTag, string> = {
  fasting: 'Натощак',
  before_meal: 'До еды',
  post1h: 'Через 1 ч',
  post2h: 'Через 2 ч',
  bedtime: 'Перед сном',
  random: 'Произвольно',
  hypo: 'Гипо',
}

export interface GlucoseReading {
  id: string
  time: string
  /** ммоль/л */
  mmol: number
  tag: GlucoseTag
  note?: string
}

export interface MedDose {
  id: string
  time: string
  name: string
  dose?: string
  taken: boolean
}

export interface DayRecord {
  schemaVersion: number
  date: string
  meals: Meal[]
  glucose: GlucoseReading[]
  meds: MedDose[]
  weightKg?: number
  steps?: number
  notes?: string
  updatedAt: string
}

export function emptyDay(date: string): DayRecord {
  return {
    schemaVersion: SCHEMA_VERSION,
    date,
    meals: [],
    glucose: [],
    meds: [],
    updatedAt: new Date().toISOString(),
  }
}

export interface Settings {
  anthropicApiKey: string
  model: string
  /** Глубина рассуждений модели: выше — точнее и дороже. */
  effort: 'low' | 'medium' | 'high'
  /** Сколько граммов углеводов в одной ХЕ. В России 10–12. */
  xeGrams: number
  /** Считать ХЕ по усвояемым углеводам (за вычетом клетчатки). */
  xeUseNetCarbs: boolean
  targetKcal: number
  targetCarbs: number
  /** Целевой коридор глюкозы, ммоль/л. */
  glucoseLow: number
  glucoseHigh: number
  /** Постоянные препараты — подставляются в план дня. */
  medications: { name: string; dose: string; time: string }[]
  /** Свободный текст о себе: он уходит в промпт ИИ. */
  healthContext: string
  github: {
    token: string
    owner: string
    repo: string
    branch: string
    /** Выгружать ли фото вместе с записями (раздувает репозиторий). */
    uploadPhotos: boolean
    autoSync: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  anthropicApiKey: '',
  model: 'claude-opus-5',
  effort: 'high',
  xeGrams: 12,
  xeUseNetCarbs: false,
  targetKcal: 1800,
  targetCarbs: 180,
  glucoseLow: 4.0,
  glucoseHigh: 8.5,
  medications: [],
  healthContext:
    'Сахарный диабет 2 типа. Терапия: Форсига (дапаглифлозин), Диабетон MR (гликлазид), ' +
    'Грандаксин. Гликлазид может вызывать гипогликемию, поэтому важны равномерное ' +
    'распределение углеводов по приёмам и отсутствие длинных перерывов между едой.',
  github: {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    uploadPhotos: false,
    autoSync: true,
  },
}
