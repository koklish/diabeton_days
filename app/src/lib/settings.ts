import { Preferences } from '@capacitor/preferences'
import { DEFAULT_SETTINGS, type Settings } from '../types'

const KEY = 'settings.v1'

/** Слияние с дефолтами: после обновления приложения в сохранённом объекте
 *  не хватает новых полей, и без этого они станут undefined. */
function merge(saved: Partial<Settings> | null): Settings {
  if (!saved) return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    github: { ...DEFAULT_SETTINGS.github, ...(saved.github ?? {}) },
    medications: saved.medications ?? DEFAULT_SETTINGS.medications,
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return merge(value ? (JSON.parse(value) as Partial<Settings>) : null)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(settings) })
}
