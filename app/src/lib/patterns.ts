import type { DayRecord } from '../types'
import type { Profile as ProfileType } from '../profile'
import { allMealResponses, minutes, type MealResponse } from './history'
import { isLateWindow, isMorningWindow } from '../profile'
import { round } from './nutrition'
import { shiftDate } from './date'

export type FindingKind = 'safety' | 'pattern' | 'win' | 'question'

export interface Finding {
  id: string
  kind: FindingKind
  title: string
  /** Основной текст. Пишется так же, как разбор: честно и без морали. */
  text: string
  /** Сколько наблюдений стоит за выводом. Меньше трёх — это ещё не вывод. */
  n: number
  strength: 'намёк' | 'похоже' | 'устойчиво'
  /** Кому это пригодится на приёме. */
  forDoctor?: 'endocrinologist' | 'neurologist' | 'psychiatrist' | 'gastro'
}

function strengthOf(n: number): Finding['strength'] {
  if (n >= 10) return 'устойчиво'
  if (n >= 5) return 'похоже'
  return 'намёк'
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function fmt(value: number, digits = 1): string {
  return round(value, digits).toFixed(digits).replace('.', ',')
}

/** Достаточно ли наблюдений, чтобы вообще говорить о связи. */
const MIN_N = 3

export function findPatterns(days: DayRecord[], profile: ProfileType): Finding[] {
  const out: Finding[] = []
  const responses = allMealResponses(days).filter((r) => r.delta != null)
  const byDate = new Map(days.map((d) => [d.date, d]))

  out.push(...hypoFindings(days, profile))
  out.push(...walkEffect(responses))
  out.push(...morningStarch(responses))
  out.push(...eveningMetformin(days, byDate, profile))
  out.push(...alcoholNights(days, byDate, profile))
  out.push(...roleEffect(responses, 'nuts', 'Орехи'))
  out.push(...roleEffect(responses, 'fruit', 'Фрукты и ягоды'))
  out.push(...lateMeals(responses))
  out.push(...dawnWave(days, byDate))
  out.push(...fastingTrend(days, profile))
  out.push(...weightTrend(days))
  out.push(...anxietyAndCravings(days))
  out.push(...handsAndLoad(days))
  out.push(...wins(days, responses, profile))

  return out
}

/** Гипогликемии — главный вопрос к эндокринологу, поэтому считаются всегда
 *  и показываются первыми, даже если эпизод один. */
function hypoFindings(days: DayRecord[], profile: ProfileType): Finding[] {
  const episodes: { date: string; time: string; mmol: number }[] = []
  for (const day of days) {
    for (const g of day.glucose) {
      if (g.mmol < profile.targets.hypo) episodes.push({ date: day.date, time: g.time, mmol: g.mmol })
    }
  }
  if (episodes.length === 0) return []
  const lowest = episodes.reduce((a, b) => (b.mmol < a.mmol ? b : a))
  const recent = episodes.slice(-5).reverse()
  return [
    {
      id: 'hypo-count',
      kind: 'safety',
      title: `Эпизоды ниже ${fmt(profile.targets.hypo)}: ${episodes.length}`,
      text:
        `Самый низкий — ${fmt(lowest.mmol)} (${lowest.date} в ${lowest.time}). ` +
        `Последние: ${recent.map((e) => `${e.date} ${e.time} — ${fmt(e.mmol)}`).join('; ')}. ` +
        'Это материал для разговора с эндокринологом про дозу Диабетона: гликлазид роняет сахар сам по себе.',
      n: episodes.length,
      strength: strengthOf(episodes.length),
      forDoctor: 'endocrinologist',
    },
  ]
}

function walkEffect(responses: MealResponse[]): Finding[] {
  const walked = responses.filter((r) => r.walked).map((r) => r.delta as number)
  const still = responses.filter((r) => !r.walked).map((r) => r.delta as number)
  if (walked.length < MIN_N || still.length < MIN_N) return []
  const diff = mean(still) - mean(walked)
  if (Math.abs(diff) < 0.2) return []
  const n = Math.min(walked.length, still.length)
  return [
    {
      id: 'walk-effect',
      kind: 'pattern',
      title: diff > 0 ? `Прогулка срезает подъём на ${fmt(diff)}` : 'Прогулка пока не даёт разницы',
      text:
        `С прогулкой подъём в среднем +${fmt(mean(walked))} (${walked.length} приёмов), ` +
        `без неё +${fmt(mean(still))} (${still.length}).`,
      n,
      strength: strengthOf(n),
    },
  ]
}

function morningStarch(responses: MealResponse[]): Finding[] {
  const morning = responses.filter((r) => isMorningWindow(r.meal.time))
  const withStarch = morning.filter((r) => r.meal.plate.starches > 0).map((r) => r.delta as number)
  const without = morning.filter((r) => r.meal.plate.starches === 0).map((r) => r.delta as number)
  if (withStarch.length < MIN_N || without.length < MIN_N) return []
  const diff = mean(withStarch) - mean(without)
  const n = Math.min(withStarch.length, without.length)
  return [
    {
      id: 'morning-starch',
      kind: 'pattern',
      title: `Крахмал на завтрак: +${fmt(diff)} к подъёму`,
      text:
        `Завтрак с крахмалом поднимает в среднем на +${fmt(mean(withStarch))} (${withStarch.length} раз), ` +
        `без крахмала — на +${fmt(mean(without))} (${without.length} раз). Это феномен зари в цифрах.`,
      n,
      strength: strengthOf(n),
      forDoctor: 'endocrinologist',
    },
  ]
}

/** Гипотеза владельца: поздний вечерний метформин даёт лучшее утро.
 *  Считается отдельно, потому что ради этой статистики раздел и заводился. */
function eveningMetformin(
  days: DayRecord[],
  byDate: Map<string, DayRecord>,
  profile: ProfileType,
): Finding[] {
  const pairs: { takenAt: number; fasting: number }[] = []
  for (const day of days) {
    const dose = day.meds.find((m) => m.kind === 'metformin_pm' && m.taken)
    if (!dose) continue
    const next = byDate.get(shiftDate(day.date, 1))
    const fasting = next?.glucose.find((g) => g.tag === 'fasting')
    if (!fasting) continue
    pairs.push({ takenAt: minutes(dose.time), fasting: fasting.mmol })
  }
  if (pairs.length < MIN_N * 2) return []
  const late = pairs.filter((p) => p.takenAt >= 22 * 60).map((p) => p.fasting)
  const early = pairs.filter((p) => p.takenAt < 22 * 60).map((p) => p.fasting)
  if (late.length < MIN_N || early.length < MIN_N) return []
  const n = Math.min(late.length, early.length)
  const best = profile.targets
  return [
    {
      id: 'metformin-pm',
      kind: 'pattern',
      title: `Вечерний метформин: позже — утро ${fmt(mean(late))}, раньше — ${fmt(mean(early))}`,
      text:
        `После 22:00: утро натощак в среднем ${fmt(mean(late))} (${late.length} дней). ` +
        `Раньше 22:00: ${fmt(mean(early))} (${early.length} дней). ` +
        `Личный ориентир — ${fmt(best.fastingBestLow)}–${fmt(best.fastingBestHigh)}. ` +
        'Готовая статистика к вопросу эндокринологу про перенос приёма на ночь.',
      n,
      strength: strengthOf(n),
      forDoctor: 'endocrinologist',
    },
  ]
}

/** Алкоголь роняет сахар с задержкой 4–12 часов. На гликлазиде это опасно. */
function alcoholNights(
  days: DayRecord[],
  byDate: Map<string, DayRecord>,
  profile: ProfileType,
): Finding[] {
  const nights: { date: string; lowest: number }[] = []
  for (const day of days) {
    if (day.alcohol.length === 0) continue
    const next = byDate.get(shiftDate(day.date, 1))
    const candidates = [
      ...day.glucose.filter((g) => g.tag === 'night' || minutes(g.time) >= 22 * 60),
      ...(next?.glucose.filter((g) => minutes(g.time) < 10 * 60) ?? []),
    ]
    if (candidates.length === 0) continue
    nights.push({ date: day.date, lowest: Math.min(...candidates.map((g) => g.mmol)) })
  }
  if (nights.length === 0) return []
  const belowHypo = nights.filter((n) => n.lowest < profile.targets.hypo)
  return [
    {
      id: 'alcohol-nights',
      kind: 'safety',
      title: `Ночи после алкоголя: ${nights.length}`,
      text:
        `Самая низкая ночная цифра в такие ночи — ${fmt(Math.min(...nights.map((n) => n.lowest)))}. ` +
        (belowHypo.length > 0
          ? `Из них ниже ${fmt(profile.targets.hypo)}: ${belowHypo.length} (${belowHypo.map((b) => b.date).join(', ')}). `
          : 'Ниже порога гипо пока не уходило. ') +
        'Алкоголь роняет сахар с задержкой 4–12 часов, чаще ночью; на гликлазиде это опасно.',
      n: nights.length,
      strength: strengthOf(nights.length),
      forDoctor: 'endocrinologist',
    },
  ]
}

function roleEffect(responses: MealResponse[], role: string, label: string): Finding[] {
  const withRole = responses
    .filter((r) => r.meal.items.some((i) => i.role === role))
    .map((r) => r.delta as number)
  const without = responses
    .filter((r) => !r.meal.items.some((i) => i.role === role))
    .map((r) => r.delta as number)
  if (withRole.length < MIN_N || without.length < MIN_N) return []
  const diff = mean(withRole) - mean(without)
  if (Math.abs(diff) < 0.2) {
    return [
      {
        id: `role-${role}`,
        kind: 'pattern',
        title: `${label} сахар почти не двигают`,
        text: `С ними подъём +${fmt(mean(withRole))}, без них +${fmt(mean(without))}. Разница в пределах шума.`,
        n: withRole.length,
        strength: strengthOf(withRole.length),
      },
    ]
  }
  return [
    {
      id: `role-${role}`,
      kind: 'pattern',
      title: `${label}: ${diff > 0 ? '+' : ''}${fmt(diff)} к подъёму`,
      text: `С ними в среднем +${fmt(mean(withRole))} (${withRole.length} приёмов), без них +${fmt(mean(without))} (${without.length}).`,
      n: Math.min(withRole.length, without.length),
      strength: strengthOf(Math.min(withRole.length, without.length)),
    },
  ]
}

function lateMeals(responses: MealResponse[]): Finding[] {
  const late = responses.filter((r) => isLateWindow(r.meal.time)).map((r) => r.delta as number)
  const day = responses.filter((r) => !isLateWindow(r.meal.time)).map((r) => r.delta as number)
  if (late.length < MIN_N || day.length < MIN_N) return []
  const diff = mean(late) - mean(day)
  if (diff < 0.2) return []
  return [
    {
      id: 'late-meals',
      kind: 'pattern',
      title: `Поздний приём висит дольше: +${fmt(diff)} против дневного`,
      text:
        `После 20:00 подъём в среднем +${fmt(mean(late))} (${late.length} приёмов), днём такой же объём даёт ` +
        `+${fmt(mean(day))} (${day.length}). Разница — это движение: днём оно есть, ночью нет.`,
      n: Math.min(late.length, day.length),
      strength: strengthOf(Math.min(late.length, day.length)),
    },
  ]
}

/** Ночная волна без еды — это заря, а не ужин. Важно уметь их различать. */
function dawnWave(days: DayRecord[], byDate: Map<string, DayRecord>): Finding[] {
  let waves = 0
  const values: number[] = []
  for (const day of days) {
    const night = day.glucose.filter((g) => {
      const m = minutes(g.time)
      return m >= 3 * 60 && m <= 4.5 * 60
    })
    if (night.length === 0) continue
    const prev = byDate.get(shiftDate(day.date, -1))
    const lateMeal = prev?.meals.some((m) => minutes(m.time) >= 22 * 60)
    if (lateMeal) continue
    waves++
    values.push(...night.map((g) => g.mmol))
  }
  if (waves < MIN_N) return []
  return [
    {
      id: 'dawn-wave',
      kind: 'pattern',
      title: `Ночная волна 03:00–04:30 без позднего ужина: ${waves} раз`,
      text: `Средняя цифра в это окно — ${fmt(mean(values))}. Еды перед этим не было, значит это заря, а не ужин.`,
      n: waves,
      strength: strengthOf(waves),
      forDoctor: 'endocrinologist',
    },
  ]
}

function fastingTrend(days: DayRecord[], profile: ProfileType): Finding[] {
  const readings = days
    .flatMap((d) => d.glucose.filter((g) => g.tag === 'fasting').map((g) => ({ date: d.date, mmol: g.mmol })))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (readings.length < MIN_N * 2) return []
  const half = Math.floor(readings.length / 2)
  const older = mean(readings.slice(0, half).map((r) => r.mmol))
  const newer = mean(readings.slice(half).map((r) => r.mmol))
  const inBest = readings.filter(
    (r) => r.mmol >= profile.targets.fastingBestLow && r.mmol <= profile.targets.fastingBestHigh,
  ).length
  return [
    {
      id: 'fasting-trend',
      kind: newer < older ? 'win' : 'pattern',
      title: `Утро натощак: ${fmt(newer)} против ${fmt(older)} раньше`,
      text:
        `Всего замеров натощак: ${readings.length}. В личном лучшем коридоре ` +
        `${fmt(profile.targets.fastingBestLow)}–${fmt(profile.targets.fastingBestHigh)}: ${inBest}.`,
      n: readings.length,
      strength: strengthOf(readings.length),
      forDoctor: 'endocrinologist',
    },
  ]
}

function weightTrend(days: DayRecord[]): Finding[] {
  const points = days
    .filter((d) => d.weightKg != null)
    .map((d) => ({ date: d.date, kg: d.weightKg as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (points.length < 2) return []
  const first = points[0]
  const last = points[points.length - 1]
  const diff = last.kg - first.kg
  return [
    {
      id: 'weight-trend',
      kind: diff < 0 ? 'win' : 'pattern',
      title: `Вес: ${fmt(last.kg)} кг (${diff >= 0 ? '+' : ''}${fmt(diff)} с ${first.date})`,
      text: `Замеров: ${points.length}. Нужен эндокринологу для разговора про дозу семаглутида.`,
      n: points.length,
      strength: strengthOf(points.length),
      forDoctor: 'endocrinologist',
    },
  ]
}

/** Срыв чаще следствие состояния, а не слабости. Эта связь должна быть видна. */
function anxietyAndCravings(days: DayRecord[]): Finding[] {
  const withState = days.filter((d) => d.state)
  if (withState.length < MIN_N * 2) return []
  const high = withState.filter((d) => (d.state?.anxiety ?? 0) >= 6)
  const low = withState.filter((d) => (d.state?.anxiety ?? 0) < 6)
  if (high.length < MIN_N || low.length < MIN_N) return []
  const rate = (list: DayRecord[]) =>
    mean(list.map((d) => d.cravings.filter((c) => c.outcome === 'ate').length))
  const diff = rate(high) - rate(low)
  if (Math.abs(diff) < 0.2) return []
  return [
    {
      id: 'anxiety-cravings',
      kind: 'pattern',
      title: 'Тревога и срывы идут вместе',
      text:
        `В дни с тревогой 6+ срывов в среднем ${fmt(rate(high))} за день (${high.length} дней), ` +
        `в спокойные — ${fmt(rate(low))} (${low.length}). Причина в состоянии, а не в силе воли: ` +
        'это разговор с психиатром, а не повод себя грызть.',
      n: Math.min(high.length, low.length),
      strength: strengthOf(Math.min(high.length, low.length)),
      forDoctor: 'psychiatrist',
    },
  ]
}

function handsAndLoad(days: DayRecord[]): Finding[] {
  const withHands = days.filter((d) => d.hands)
  if (withHands.length < MIN_N) return []
  const out: Finding[] = []

  const weakDays = withHands.filter((d) => (d.hands?.weakness ?? 0) >= 4 || d.hands?.droppedThings)
  if (weakDays.length > 0) {
    out.push({
      id: 'hands-weakness',
      kind: 'safety',
      title: `Дни со слабостью в руках: ${weakDays.length}`,
      text:
        `Последние: ${weakDays.slice(-5).map((d) => d.date).join(', ')}. ` +
        'Отёк от нагрузки, который проходит за часы, — одно. Слабость, из-за которой ' +
        'роняешь предметы, — другое, и это повод показаться неврологу, а не переждать.',
      n: weakDays.length,
      strength: strengthOf(weakDays.length),
      forDoctor: 'neurologist',
    })
  }

  const triggers = new Map<string, number[]>()
  for (const d of withHands) {
    const severity = Math.max(d.hands?.numbness ?? 0, d.hands?.burning ?? 0, d.hands?.swelling ?? 0)
    for (const t of d.hands?.triggers ?? []) {
      triggers.set(t, [...(triggers.get(t) ?? []), severity])
    }
  }
  const ranked = [...triggers.entries()]
    .filter(([, v]) => v.length >= 2)
    .sort((a, b) => mean(b[1]) - mean(a[1]))
    .slice(0, 3)
  if (ranked.length > 0) {
    out.push({
      id: 'hands-triggers',
      kind: 'pattern',
      title: 'Что сильнее всего бьёт по рукам',
      text: ranked.map(([t, v]) => `${t}: в среднем ${fmt(mean(v))} из 10 (${v.length} раз)`).join('; ') + '.',
      n: ranked.reduce((a, [, v]) => a + v.length, 0),
      strength: strengthOf(ranked.reduce((a, [, v]) => a + v.length, 0)),
      forDoctor: 'neurologist',
    })
  }

  const recovery = withHands
    .map((d) => d.hands?.minutesToRecover)
    .filter((v): v is number => v != null)
  if (recovery.length >= MIN_N) {
    out.push({
      id: 'hands-recovery',
      kind: 'pattern',
      title: `Восстановление после нагрузки: ${Math.round(mean(recovery))} мин в среднем`,
      text:
        `Замеров: ${recovery.length}, разброс ${Math.min(...recovery)}–${Math.max(...recovery)} мин. ` +
        'На МСЭ оценивают степень нарушения функции, и такие записи — лучшее доказательство.',
      n: recovery.length,
      strength: strengthOf(recovery.length),
      forDoctor: 'neurologist',
    })
  }
  return out
}

/** Победы считаются наравне с проблемами: видимый прогресс держит на плаву. */
function wins(days: DayRecord[], responses: MealResponse[], profile: ProfileType): Finding[] {
  const out: Finding[] = []

  const goodPeaks = responses.filter((r) => (r.peak ?? 99) <= profile.targets.peakOk)
  if (responses.length >= MIN_N) {
    const pct = Math.round((goodPeaks.length / responses.length) * 100)
    out.push({
      id: 'peaks-ok',
      kind: 'win',
      title: `Пик до ${fmt(profile.targets.peakOk)}: ${pct}% приёмов`,
      text: `${goodPeaks.length} из ${responses.length} замеренных приёмов уложились в целевой пик.`,
      n: responses.length,
      strength: strengthOf(responses.length),
    })
  }

  const passed = days.flatMap((d) => d.cravings).filter((c) => c.outcome === 'passed' || c.outcome === 'safe_snack')
  const total = days.flatMap((d) => d.cravings).length
  if (total >= MIN_N) {
    out.push({
      id: 'cravings-passed',
      kind: 'win',
      title: `Волну удалось пережить: ${passed.length} из ${total}`,
      text: 'Каждый такой раз — не случайность, а навык. Срывы в этот счёт тоже входят и ничего не обнуляют.',
      n: total,
      strength: strengthOf(total),
    })
  }

  const noStarchDinners = days.flatMap((d) =>
    d.meals.filter((m) => isLateWindow(m.time) && m.plate.starches === 0 && m.plate.hasProtein),
  )
  if (noStarchDinners.length >= MIN_N) {
    out.push({
      id: 'clean-dinners',
      kind: 'win',
      title: `Поздних приёмов без крахмала: ${noStarchDinners.length}`,
      text: 'Правило «после 20:00 только белок» работает — это видно по записям, а не на словах.',
      n: noStarchDinners.length,
      strength: strengthOf(noStarchDinners.length),
    })
  }
  return out
}
