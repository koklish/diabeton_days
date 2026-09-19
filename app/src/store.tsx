import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_SETTINGS, type DayRecord, type Settings } from './types'
import { loadSettings, saveSettings } from './lib/settings'
import { listDays, loadDay, saveDay } from './lib/db'
import { todayKey } from './lib/date'
import { pushDay, pushIndex } from './lib/github'

interface Toast {
  text: string
  kind: 'ok' | 'err'
}

interface Store {
  ready: boolean
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  date: string
  setDate: (date: string) => void
  day: DayRecord
  /** Записать день локально и, если включено, отправить в репозиторий. */
  commitDay: (next: DayRecord) => Promise<void>
  reloadDay: () => Promise<void>
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
  const [day, setDay] = useState<DayRecord>(() => ({
    schemaVersion: 2, date: todayKey(), meals: [], glucose: [], meds: [], updatedAt: new Date().toISOString(),
  }))
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, kind })
    toastTimer.current = window.setTimeout(() => setToast(null), kind === 'err' ? 6000 : 3000)
  }, [])

  useEffect(() => {
    void (async () => {
      const loaded = await loadSettings()
      setSettings(loaded)
      setDay(await loadDay(todayKey()))
      setReady(true)
    })()
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!ready) return
    void loadDay(date).then(setDay)
  }, [date, ready])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, github: { ...prev.github, ...(patch.github ?? {}) } }
      void saveSettings(next)
      return next
    })
  }, [])

  const reloadDay = useCallback(async () => {
    setDay(await loadDay(date))
  }, [date])

  const commitDay = useCallback(
    async (next: DayRecord) => {
      const saved = await saveDay(next)
      setDay(saved)
      const gh = settings.github
      if (gh.autoSync && gh.token && gh.owner && gh.repo) {
        try {
          await pushDay(saved, settings)
        } catch (err) {
          // Локальная запись уже сохранена — потеря синхронизации не должна
          // выглядеть как потеря данных.
          showToast(
            `Сохранено на телефоне, но не выгружено: ${err instanceof Error ? err.message : String(err)}`,
            'err',
          )
        }
      }
    },
    [settings, showToast],
  )

  const syncNow = useCallback(async () => {
    const gh = settings.github
    if (!gh.token || !gh.owner || !gh.repo) {
      showToast('Сначала настройте выгрузку в GitHub', 'err')
      return
    }
    setSyncing(true)
    try {
      const days = await listDays()
      let pushed = 0
      const failed: string[] = []
      for (const d of days) {
        try {
          await pushDay(d, settings)
          pushed++
        } catch (err) {
          failed.push(`${d.date}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (pushed > 0) await pushIndex(days, settings)
      if (failed.length === 0) showToast(`Выгружено записей: ${pushed}`)
      else showToast(`Выгружено ${pushed}, с ошибкой ${failed.length}. ${failed[0]}`, 'err')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'err')
    } finally {
      setSyncing(false)
    }
  }, [settings, showToast])

  const value = useMemo<Store>(
    () => ({
      ready, settings, updateSettings, date, setDate, day,
      commitDay, reloadDay, syncing, syncNow, toast, showToast,
    }),
    [ready, settings, updateSettings, date, day, commitDay, reloadDay, syncing, syncNow, toast, showToast],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore вызван вне StoreProvider')
  return ctx
}
