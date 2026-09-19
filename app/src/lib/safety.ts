import type { DayRecord } from '../types'
import type { Profile } from '../profile'
import { minutes } from './history'
import { shiftDate } from './date'

export interface Alert {
  id: string
  level: 'urgent' | 'attention' | 'note'
  title: string
  /** Что делать. Конкретно и по шагам — читать это будут не в лучшем состоянии. */
  steps: string[]
  footnote?: string
}

/** Протокол при низком сахаре. Не «отметить в журнале», а что делать прямо сейчас.
 *  Гликлазид роняет сахар сам по себе и умеет ронять повторно через часы. */
export function hypoProtocol(mmol: number, profile: Profile): Alert | null {
  if (mmol >= profile.targets.hypo) return null
  const severe = mmol < 3.0
  return {
    id: 'hypo',
    level: 'urgent',
    title: severe ? `${fmt(mmol)} — это низко` : `${fmt(mmol)} — ниже ${fmt(profile.targets.hypo)}`,
    steps: [
      'Прими 15 г быстрых углеводов: 3–4 таблетки глюкозы, 150 мл сока или 1 ст. ложка мёда.',
      'Подожди 15 минут и перемерь.',
      'Если всё ещё ниже — повтори 15 г и перемерь ещё через 15 минут.',
      'Когда поднимется — добавь белок или сложный углевод, иначе может упасть снова.',
      ...(severe
        ? ['Если становится хуже, путается сознание или нет улучшения после двух подходов — вызывай помощь.']
        : []),
    ],
    footnote:
      'На Диабетоне падение может повториться через несколько часов, в том числе ночью. ' +
      'Эпизод записывается в счётчик — это главный вопрос к эндокринологу про дозу.',
  }
}

/** Алкоголь не поднимает сахар, а роняет — с задержкой 4–12 часов, чаще ночью. */
export function alcoholAlert(day: DayRecord): Alert | null {
  if (day.alcohol.length === 0) return null
  const last = day.alcohol.reduce((a, b) => (minutes(b.time) > minutes(a.time) ? b : a))
  const [h, m] = last.time.split(':').map(Number)
  const from = `${String((h + 4) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const to = `${String((h + 12) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return {
    id: 'alcohol',
    level: 'attention',
    title: 'Сегодня был алкоголь — следи за ночью',
    steps: [
      `Провал вероятен примерно с ${from} до ${to}, то есть во сне.`,
      'Перед сном съешь белок: творог, яйцо, кусок сыра. Он держит ночь.',
      'Измерь перед сном и, если получится, ночью.',
      'Низкая цифра сразу после выпитого — не «пронесло»: настоящий провал приходит позже.',
    ],
    footnote: 'На гликлазиде сочетание с алкоголем опаснее обычного.',
  }
}

/** Отёк от нагрузки, который проходит за часы, — одно. Слабость — другое. */
export function handsAlert(day: DayRecord): Alert | null {
  const h = day.hands
  if (!h) return null
  if (h.weakness < 4 && !h.droppedThings) return null
  return {
    id: 'hands',
    level: 'attention',
    title: 'Сегодня отмечена слабость в руках',
    steps: [
      'Слабость — не «плохой день». Это про функцию, а не про усталость.',
      'Запиши, что ей предшествовало и прошла ли она после отдыха: невролог спросит именно это.',
      'Если слабость не уходит за сутки или повторяется — это повод записаться, а не переждать.',
    ],
    footnote: 'На МСЭ оценивают степень нарушения функции. Такие записи — лучшее доказательство.',
  }
}

/** Несколько тяжёлых дней подряд — повод спокойно напомнить про врача, без драмы. */
export function mentalStateAlert(days: DayRecord[]): Alert | null {
  const recent = days.slice(0, 5).filter((d) => d.state)
  if (recent.length < 3) return null
  const rough = recent.filter(
    (d) => (d.state?.anxiety ?? 0) >= 7 || (d.state?.mood ?? 10) <= 3 || (d.state?.panicAttacks ?? 0) > 0,
  )
  if (rough.length < 3) return null
  return {
    id: 'mental',
    level: 'note',
    title: `Тяжело уже ${rough.length} дня из последних ${recent.length}`,
    steps: [
      'Это не про силу воли и не повод себя грызть.',
      'Когда состояние держится несколько дней подряд, это вопрос к психиатру, а не к терпению.',
      'В прошлый раз причиной срывов была отмена антидепрессанта, а не слабость. Стоит проверить, не повторяется ли.',
    ],
  }
}

/** Ночная гипо после позднего приёма или алкоголя — отдельная проверка:
 *  утром её уже не увидеть, а она была. */
export function nightRiskAlert(day: DayRecord, prev: DayRecord | undefined, profile: Profile): Alert | null {
  if (!prev) return null
  const nightLows = day.glucose.filter((g) => minutes(g.time) < 8 * 60 && g.mmol < profile.targets.hypo)
  if (nightLows.length === 0) return null
  const hadAlcohol = prev.alcohol.length > 0
  return {
    id: 'night-low',
    level: 'attention',
    title: `Ночью было ${fmt(Math.min(...nightLows.map((g) => g.mmol)))}`,
    steps: [
      hadAlcohol
        ? 'Накануне был алкоголь — это его отложенный провал, ровно тот случай, о котором предупреждали.'
        : 'Ночной провал без алкоголя — это вопрос к дозе вечерних препаратов.',
      'Запиши эпизод: счётчик ночных гипо это самое весомое, что можно принести эндокринологу.',
    ],
  }
}

export function collectAlerts(day: DayRecord, days: DayRecord[], profile: Profile): Alert[] {
  const prev = days.find((d) => d.date === shiftDate(day.date, -1))
  const lowest = day.glucose.reduce<number | null>(
    (a, g) => (a == null || g.mmol < a ? g.mmol : a),
    null,
  )
  return [
    lowest != null ? hypoProtocol(lowest, profile) : null,
    nightRiskAlert(day, prev, profile),
    alcoholAlert(day),
    handsAlert(day),
    mentalStateAlert(days),
  ].filter((a): a is Alert => a !== null)
}

function fmt(value: number): string {
  return value.toFixed(1).replace('.', ',')
}
