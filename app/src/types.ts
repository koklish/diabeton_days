// Модель данных дневника. Одна запись = одни сутки.
// Всё отсюда уезжает в реестр как days/ГГГГ-ММ-ДД.json: файлы читают человек,
// врачи и Claude, поэтому имена полей стабильные и говорящие.

import { DEFAULT_PROFILE, type Profile } from './profile'

export const SCHEMA_VERSION = 3

export type Confidence = 'high' | 'medium' | 'low'

export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_KIND_RU: Record<MealKind, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

/** Роль позиции в тарелке. Это, а не калории, определяет разбор приёма. */
export type FoodRole = 'protein' | 'starch' | 'vegetable' | 'fruit' | 'fat' | 'sweet' | 'nuts' | 'drink'

export const FOOD_ROLE_RU: Record<FoodRole, string> = {
  protein: 'белок',
  starch: 'крахмал',
  vegetable: 'овощи',
  fruit: 'фрукты',
  fat: 'жир',
  sweet: 'сладкое',
  nuts: 'орехи',
  drink: 'напиток',
}

/** Пищевая ценность на 100 г готового блюда. Модель оценивает именно это:
 *  справочные значения она помнит лучше, чем умеет умножать. Абсолютные цифры
 *  порции приложение считает само. */
export interface Per100 {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
}

export interface FoodItem {
  id: string
  name: string
  role: FoodRole
  /** Бытовое описание порции: «с кулак», «две столовые ложки».
   *  Показывается вместо граммов — так владелец и думает о еде. */
  portion: string
  grams: number
  gramsMin?: number
  gramsMax?: number
  per100: Per100
  gi: number | null
  confidence: Confidence
  note?: string
}

/** Структура тарелки — то, как владелец сам думает о еде. */
export interface Plate {
  /** Сколько крахмалов в приёме. Правило: один. */
  starches: number
  hasProtein: boolean
  vegShare: 'none' | 'some' | 'half' | 'most'
  hasSweet: boolean
  /** Соблюдён ли порядок «белок → овощи → гарнир». null, если по фото не видно. */
  proteinFirst: boolean | null
}

export const VEG_SHARE_RU: Record<Plate['vegShare'], string> = {
  none: 'нет',
  some: 'немного',
  half: 'половина',
  most: 'больше половины',
}

/** Разбор приёма, как его отдаёт модель. Хранится вместе с приёмом,
 *  чтобы потом было видно, на чём строился вывод. */
export interface MealVerdict {
  /** Ровно два значения — так просил владелец. Нюансы живут в explanation. */
  verdict: 'честно' | 'не честно'
  /** Приём, который стоит засчитать как победу, а не просто «нормально». */
  isWin: boolean
  /** Одна строка: почему такой вердикт. */
  verdictReason: string
  /** 1–2 предложения: почему сахар пойдёт так, а не иначе. */
  explanation: string
  /** Что засчитать в плюс. Пусто — значит правда не за что. */
  wins: string[]
  /** Одно конкретное действие, которое ещё можно сделать. null — ничего не надо. */
  fix: string | null
  warnings: string[]
  questions: string[]
  /** Ожидаемое поведение сахара — текстом, без ложной точности. */
  expectedCurve: string
  /** Приёмы из истории, на которые опирался вывод. */
  basedOnPastMeals: string[]
}

export interface Meal {
  id: string
  time: string
  kind: MealKind
  title: string
  photoId?: string
  items: FoodItem[]
  plate: Plate
  verdict?: MealVerdict
  note?: string
  source: 'ai' | 'manual'
  model?: string
  editedByUser: boolean
  /** Запланированный вкусный приём. Не нарушение, а часть системы. */
  plannedTreat: boolean
  createdAt: string
}

export type GlucoseTag =
  | 'fasting'
  | 'before_meal'
  | 'post1h'
  | 'post2h'
  | 'post3h'
  | 'bedtime'
  | 'night'
  | 'random'
  | 'hypo'

export const GLUCOSE_TAG_RU: Record<GlucoseTag, string> = {
  fasting: 'Утро натощак',
  before_meal: 'До еды',
  post1h: 'Через 1 ч',
  post2h: 'Через 2 ч',
  post3h: 'Через 3 ч',
  bedtime: 'Перед сном',
  night: 'Ночью',
  random: 'Произвольно',
  hypo: 'Гипо',
}

export interface GlucoseReading {
  id: string
  time: string
  mmol: number
  tag: GlucoseTag
  /** К какому приёму относится замер — связь «еда → сахар» строится по ней. */
  mealId?: string
  source: 'meter' | 'cgm'
  note?: string
}

/** Сводка с датчика за период — то, что сейчас приходится скринить из чужого приложения. */
export interface CgmSummary {
  periodDays: number
  avgMmol: number
  eHbA1c: number | null
  timeInRangePct: number | null
  timeLowPct: number | null
  timeVeryLowPct: number | null
  maxMmol: number | null
  minMmol: number | null
  note?: string
}

/** Движение. Прогулка после еды реально срезает пик — без неё цифры сахара врут. */
export interface ActivityEntry {
  id: string
  time: string
  kind: 'walk' | 'household' | 'workout' | 'other'
  minutes: number
  /** После какого приёма. Именно это делает запись ценной. */
  afterMealId?: string
  note?: string
}

export const ACTIVITY_KIND_RU: Record<ActivityEntry['kind'], string> = {
  walk: 'Прогулка',
  household: 'Бытовая нагрузка',
  workout: 'Тренировка',
  other: 'Другое',
}

export interface MedDose {
  id: string
  planId?: string
  time: string
  name: string
  dose?: string
  kind: string
  taken: boolean
  note?: string
}

/** Руки. Обязательный раздел: это доказательная база для невролога и для МСЭ,
 *  где оценивают не диагноз, а степень нарушения функции. */
export interface HandsEntry {
  /** 0 — нет, 10 — невыносимо. */
  numbness: number
  burning: number
  swelling: number
  /** Слабость — отдельная история: не «плохой день», а повод к врачу. */
  weakness: number
  /** Ронял предметы, не мог удержать, кисть не слушалась. */
  droppedThings: boolean
  /** Через сколько минут нагрузки затекает. */
  minutesToNumb: number | null
  /** За сколько минут отдыха восстанавливается. */
  minutesToRecover: number | null
  triggers: string[]
  note?: string
}

export const HAND_TRIGGERS = [
  'носил ребёнка',
  'долго печатал',
  'телефон лёжа',
  'спал на согнутой руке',
  'руль',
  'сумки',
  'бытовая работа',
] as const

export interface StateEntry {
  /** 0 — спокойно, 10 — невыносимо. */
  anxiety: number
  /** 0 — очень плохо, 10 — хорошо. */
  mood: number
  sleepHours: number | null
  sleepQuality: number | null
  panicAttacks: number
  /** Как прошёл день по самоконтролю — своими словами, без оценок. */
  note?: string
}

export interface GutEntry {
  nausea: number
  pain: number
  /** Голодные боли по утрам — отдельная тема для гастроэнтеролога. */
  morningHungerPain: boolean
  stool: 'norm' | 'loose' | 'hard' | 'none'
  note?: string
}

export const STOOL_RU: Record<GutEntry['stool'], string> = {
  norm: 'норма',
  loose: 'жидкий',
  hard: 'твёрдый',
  none: 'не было',
}

/** Алкоголь роняет сахар с задержкой 4–12 часов, чаще ночью.
 *  На гликлазиде это опасно, поэтому он отдельной сущностью. */
export interface AlcoholEntry {
  id: string
  time: string
  drink: string
  /** Условные порции: 1 ≈ бокал вина / 50 мл крепкого / 0,33 пива. */
  units: number
  note?: string
}

/** Эпизод тяги: нажал «тянет» — что было и чем кончилось. */
export interface CravingEntry {
  id: string
  time: string
  /** 0–10, насколько накрыло. */
  intensity: number
  trigger?: string
  /** Чем закончилось. «Сорвался» записывается так же спокойно, как остальное. */
  outcome: 'passed' | 'safe_snack' | 'ate' | 'unknown'
  /** Сколько минут продержался до исхода. */
  minutes?: number
  glucoseAtStart?: number
  note?: string
}

export const CRAVING_OUTCOME_RU: Record<CravingEntry['outcome'], string> = {
  passed: 'волна прошла',
  safe_snack: 'безопасный перекус',
  ate: 'поел',
  unknown: 'не отмечено',
}

export interface DayRecord {
  schemaVersion: number
  date: string
  meals: Meal[]
  glucose: GlucoseReading[]
  cgm?: CgmSummary
  activity: ActivityEntry[]
  meds: MedDose[]
  hands?: HandsEntry
  state?: StateEntry
  gut?: GutEntry
  alcohol: AlcoholEntry[]
  cravings: CravingEntry[]
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
    activity: [],
    meds: [],
    alcohol: [],
    cravings: [],
    updatedAt: new Date().toISOString(),
  }
}

/** Записи, созданные ранними версиями, не должны падать на отсутствующих массивах. */
export function normalizeDay(day: Partial<DayRecord> & { date: string }): DayRecord {
  return {
    ...emptyDay(day.date),
    ...day,
    meals: (day.meals ?? []).map((m) => ({
      ...m,
      plate: m.plate ?? { starches: 0, hasProtein: false, vegShare: 'none', proteinFirst: null, hasSweet: false },
      plannedTreat: m.plannedTreat ?? false,
      items: (m.items ?? []).map((i) => ({
        ...i,
        role: i.role ?? 'starch',
        portion: i.portion ?? '',
        per100: i.per100 ?? { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
      })),
    })),
    glucose: (day.glucose ?? []).map((g) => ({ ...g, source: g.source ?? 'meter' })),
    activity: day.activity ?? [],
    meds: day.meds ?? [],
    alcohol: day.alcohol ?? [],
    cravings: day.cravings ?? [],
    schemaVersion: SCHEMA_VERSION,
  }
}

export interface Settings {
  anthropicApiKey: string
  model: string
  effort: 'low' | 'medium' | 'high'
  profile: Profile
  github: {
    token: string
    owner: string
    repo: string
    branch: string
    uploadPhotos: boolean
    autoSync: boolean
    /** Проверка показала, что репозиторий публичный: там медицинские данные. */
    repoIsPublic: boolean | null
  }
}

export const DEFAULT_SETTINGS: Settings = {
  anthropicApiKey: '',
  model: 'claude-opus-5',
  effort: 'high',
  profile: DEFAULT_PROFILE,
  github: {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    uploadPhotos: false,
    // Выгрузка выключена по умолчанию: здесь медицинские данные,
    // и включать её стоит осознанно, указав приватный репозиторий.
    autoSync: false,
    repoIsPublic: null,
  },
}
