/** Локальная дата в формате YYYY-MM-DD (не UTC: сутки должны совпадать с днём пользователя). */
export function toDateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayKey(): string {
  return toDateKey()
}

export function nowTime(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toDateKey(dt)
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

export function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${d} ${MONTHS[m - 1]} ${y}, ${WEEKDAYS[dt.getDay()]}`
}

export function relativeDayLabel(dateKey: string): string | null {
  const today = todayKey()
  if (dateKey === today) return 'Сегодня'
  if (dateKey === shiftDate(today, -1)) return 'Вчера'
  if (dateKey === shiftDate(today, 1)) return 'Завтра'
  return null
}

/** Приём пищи по времени суток — чтобы не заставлять выбирать вручную. */
export function guessMealKind(time: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = Number(time.split(':')[0])
  if (h >= 5 && h < 11) return 'breakfast'
  if (h >= 11 && h < 16) return 'lunch'
  if (h >= 16 && h < 22) return 'dinner'
  return 'snack'
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
