// Личный профиль: то, что приложение знает про владельца и учитывает само,
// не спрашивая каждый раз. Отсюда же строится контекст для разбора приёмов пищи.
// Всё редактируется в настройках, но значения по умолчанию — реальные.

export interface FoodPrefs {
  /** Не ест. Предлагать бессмысленно — это вкус, а не аллергия. */
  excluded: string[]
  proteins: string[]
  vegetables: string[]
  starches: string[]
  /** Сладкое, которое не ломает режим — показывается в момент тяги. */
  safeSweets: string[]
}

export interface GlucoseTargets {
  /** Дневной коридор. */
  dayLow: number
  dayHigh: number
  /** Утро натощак: верхняя граница и личный лучший диапазон. */
  fastingHigh: number
  fastingBestLow: number
  fastingBestHigh: number
  /** Пик после еды: до peakOk — нормально, от peakReview — разбирать приём. */
  peakOk: number
  peakReview: number
  /** Ниже этого — гипогликемия, нужен протокол, а не отметка в журнале. */
  hypo: number
}

export type MedKind =
  | 'metformin_am'
  | 'metformin_pm'
  | 'gliclazide'
  | 'dapagliflozin'
  | 'semaglutide'
  | 'psych'
  | 'other'

export interface MedPlan {
  id: string
  name: string
  dose: string
  /** Ожидаемое время приёма. Для вечернего метформина оно само по себе — гипотеза. */
  time: string
  kind: MedKind
  /** weekly — для Семавика: не ждать его каждый день. */
  schedule: 'daily' | 'weekly' | 'as_needed'
  weekday?: number
  note?: string
}

export interface Profile {
  diagnosis: string
  /** Почему всё это делается. Идёт в промпт: приоритет задаёт смысл разбора. */
  priority: string
  prefs: FoodPrefs
  /** Правила, выстраданные на глюкометре. Разбор опирается на них. */
  rules: string[]
  targets: GlucoseTargets
  meds: MedPlan[]
  /** Свободные дополнения, которые владелец допишет сам. */
  extraContext: string
}

export const DEFAULT_PROFILE: Profile = {
  diagnosis:
    'Сахарный диабет 2 типа, вес 137 кг. Диабетическая полинейропатия рук, ' +
    'туннельные синдромы, грыжа шейного отдела — по ЭНМГ отрицательная динамика за год. ' +
    'Генерализованное тревожное расстройство с депрессивной частью. ' +
    '12 лет чистоты после 8–10 лет зависимости; еда сейчас работает как вещество.',
  priority:
    'Главное — сохранить функцию рук. Каждый лишний скачок сахара работает против нервов. ' +
    'Это не про похудение и не про красивые графики.',
  prefs: {
    excluded: ['помидоры', 'грибы', 'брокколи', 'чечевица', 'булгур', 'рыба (кроме консервированного тунца)'],
    proteins: [
      'курица (бедро)',
      'индейка',
      'говядина',
      'творог',
      'адыгейский сыр',
      'яйца',
      'греческий йогурт',
      'тунец консервированный',
    ],
    vegetables: ['огурец', 'болгарский перец', 'капуста', 'кабачок', 'зелень', 'салаты'],
    starches: ['гречка', 'бурый рис'],
    safeSweets: [
      'меренги без сахара',
      'шоколад 70 %',
      'творог с сахзамом и ягодами',
      'желе',
      'протеиновый коктейль',
      'орехи 30 г',
    ],
  },
  rules: [
    'Один крахмал на приём — не два и не три.',
    'Белок первым, потом овощи, потом гарнир.',
    'Половина тарелки — овощи.',
    'После 20:00 только белок.',
    'Последний приём за три часа до сна.',
    'Прогулка 15–30 минут после еды.',
    'Орехи сахар не двигают, порция 30 г.',
    'Фрукты и ягоды днём, после белка, не на ночь.',
    '«Без добавления сахара» не значит без сахара — смотреть углеводы на 100 г.',
    'Гарнир один, с кулак, лучше в обед.',
  ],
  targets: {
    dayLow: 5.4,
    dayHigh: 6.8,
    fastingHigh: 6.5,
    fastingBestLow: 5.8,
    fastingBestHigh: 6.1,
    peakOk: 7.5,
    peakReview: 8.5,
    hypo: 3.9,
  },
  meds: [
    { id: 'met-am', name: 'Метформин', dose: '', time: '08:00', kind: 'metformin_am', schedule: 'daily' },
    {
      id: 'met-pm',
      name: 'Метформин (вечер)',
      dose: '',
      time: '22:00',
      kind: 'metformin_pm',
      schedule: 'daily',
      note: 'Время приёма — проверяемая гипотеза: поздний приём даёт утро 5,8–6,1.',
    },
    { id: 'gliclazide', name: 'Диабетон MR', dose: '', time: '08:00', kind: 'gliclazide', schedule: 'daily' },
    { id: 'forxiga', name: 'Форсига', dose: '', time: '08:00', kind: 'dapagliflozin', schedule: 'daily' },
    {
      id: 'semavic',
      name: 'Семавик',
      dose: '',
      time: '10:00',
      kind: 'semaglutide',
      schedule: 'weekly',
      weekday: 0,
    },
  ],
  extraContext: '',
}

/** Утро особое: феномен зари. Один и тот же крахмал бьёт сильнее, чем в обед. */
export function isMorningWindow(time: string): boolean {
  const h = Number(time.split(':')[0])
  return h >= 4 && h < 11
}

/** После 20:00 работает правило «только белок», и приём не сгорит — человек лежит. */
export function isLateWindow(time: string): boolean {
  const h = Number(time.split(':')[0])
  return h >= 20 || h < 4
}

/** Текст профиля для промпта. Собирается в одном месте, чтобы разбор приёма,
 *  поиск закономерностей и помощь при тяге видели одну и ту же картину. */
export function profileToPrompt(profile: Profile): string {
  const t = profile.targets
  return [
    profile.diagnosis,
    profile.priority,
    '',
    `Не ест: ${profile.prefs.excluded.join(', ')}.`,
    `Белок: ${profile.prefs.proteins.join(', ')}.`,
    `Овощи: ${profile.prefs.vegetables.join(', ')}.`,
    `Гарниры: ${profile.prefs.starches.join(', ')}.`,
    '',
    'Его правила:',
    ...profile.rules.map((r) => `- ${r}`),
    '',
    `Целевые цифры: днём ${t.dayLow}–${t.dayHigh}; утром натощак до ${t.fastingHigh}, ` +
      `личное лучшее ${t.fastingBestLow}–${t.fastingBestHigh}; пик после еды до ${t.peakOk} — норма, ` +
      `от ${t.peakReview} — разбирать приём; ниже ${t.hypo} — гипогликемия.`,
    '',
    'Утро особое: феномен зари. Крахмал на завтрак поднимает сахар сильнее, чем тот же ' +
      'крахмал в обед. Одну и ту же тарелку оценивай по-разному в зависимости от времени суток.',
    profile.extraContext.trim(),
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .trim()
}
