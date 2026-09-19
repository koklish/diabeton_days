import { Preferences } from '@capacitor/preferences'
import { DEFAULT_SETTINGS, type Settings } from '../types'
import { DEFAULT_PROFILE } from '../profile'

const KEY = 'settings.v2'

/** Слияние с дефолтами: после обновления приложения в сохранённом объекте
 *  не хватает новых полей, и без этого они станут undefined. */
function merge(saved: Partial<Settings> | null): Settings {
  if (!saved) return structuredClone(DEFAULT_SETTINGS)
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    profile: {
      ...DEFAULT_PROFILE,
      ...(saved.profile ?? {}),
      prefs: { ...DEFAULT_PROFILE.prefs, ...(saved.profile?.prefs ?? {}) },
      targets: { ...DEFAULT_PROFILE.targets, ...(saved.profile?.targets ?? {}) },
      meds: saved.profile?.meds ?? DEFAULT_PROFILE.meds,
      rules: saved.profile?.rules ?? DEFAULT_PROFILE.rules,
    },
    github: { ...DEFAULT_SETTINGS.github, ...(saved.github ?? {}) },
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return merge(value ? (JSON.parse(value) as Partial<Settings>) : null)
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(settings) })
}
