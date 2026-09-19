import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_SETTINGS, emptyDay, type DayRecord, type Settings } from './types'
import { loadSettings, saveSettings } from './lib/settings'
import { listDays, loadDay, saveDay } from './lib/db'
import { shiftDate, todayKey } from './lib/date'
import { pushDay, pushIndex } from './lib/github'
import { collectAlerts, type Alert } from './lib/safety'

interface Toast {
  text: string
  kind: 'ok' | 'err'
}

interface Store {
  ready: boolean
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  date: string
  setDate: (date: string) => void
  day: DayRecord
  /** Все записи, новые первыми. Нужны для истории в промпте и для закономерностей. */
  days: DayRecord[]
  commitDay: (next: DayRecord) => Promise<void>
  alerts: Alert[]
  syncing: boolean
  syncNow: () => Promise<void>
  toast: Toast | null
  showToast: (text: string, kind?: 'ok' | 'err') => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [date, setDate] = useState(todayKey())
  const [day, setDay] = useState<DayRecord>(() => emptyDay(todayKey()))
  const [days, setDays] = useState<DayRecord[]>([])
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, kind })
    toastTimer.current = window.setTimeout(() => setToast(null), kind === 'err' ? 7000 : 3000)
  }, [])

  useEffect(() => {
    void (async () => {
      setSettings(await loadSettings())
      const all = await listDays()
      setDays(all)
      setDay(all.find((d) => d.date === todayKey()) ?? emptyDay(todayKey()))
      setReady(true)
    })()
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!ready) return
    void loadDay(date).then(setDay)
  }, [date, ready])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, github: { ...prev.github, ...(patch.github ?? {}) } }
      void saveSettings(next)
      return next
    })
  }, [])

  const commitDay = useCallback(
    async (next: DayRecord) => {
      const saved = await saveDay(next)
      setDay(saved)
      setDays((prev) => {
        const without = prev.filter((d) => d.date !== saved.date)
        return [saved, ...without].sort((a, b) => b.date.localeCompare(a.date))
      })

      const gh = settings.github
      if (gh.autoSync && gh.token && gh.owner && gh.repo) {
        try {
          // Соседние дни нужны, чтобы отклик сахара на поздний ужин
          // не потерялся: он приходит уже в записи следующих суток.
          const around = days.filter(
            (d) => d.date === shiftDate(saved.date, -1) || d.date === shiftDate(saved.date, 1),
          )
          await pushDay(saved, settings, [saved, ...around])
        } catch (err) {
          // Запись уже сохранена на телефоне. Неудачная выгрузка не должна
          // выглядеть как потеря данных.
          showToast(
            `Сохранено на телефоне, но не выгружено: ${err instanceof Error ? err.message : String(err)}`,
            'err',
          )
        }
      }
    },
    [settings, days, showToast],
  )

  const syncNow = useCallback(async () => {
    const gh = settings.github
    if (!gh.token || !gh.owner || !gh.repo) {
      showToast('Сначала настрой выгрузку в «Настройках»', 'err')
      return
    }
    setSyncing(true)
    try {
      const all = await listDays()
      let pushed = 0
      const failed: string[] = []
      for (const d of all) {
        try {
          await pushDay(d, settings, all)
          pushed++
        } catch (err) {
          failed.push(`${d.date}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (pushed > 0) await pushIndex(all, settings)
      setDays(all)
      if (failed.length === 0) showToast(`Выгружено записей: ${pushed}`)
      else showToast(`Выгружено ${pushed}, с ошибкой ${failed.length}. ${failed[0]}`, 'err')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'err')
    } finally {
      setSyncing(false)
    }
  }, [settings, showToast])

  const alerts = useMemo(() => collectAlerts(day, days, settings.profile), [day, days, settings.profile])

  const value = useMemo<Store>(
    () => ({
      ready, settings, updateSettings, date, setDate, day, days,
      commitDay, alerts, syncing, syncNow, toast, showToast,
    }),
    [ready, settings, updateSettings, date, day, days, commitDay, alerts, syncing, syncNow, toast, showToast],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore вызван вне StoreProvider')
  return ctx
}
