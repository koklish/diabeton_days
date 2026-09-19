import { openDB, type IDBPDatabase } from 'idb'
import type { DayRecord } from '../types'
import { emptyDay, normalizeDay } from '../types'

const DB_NAME = 'diabeton-days'
const DB_VERSION = 1
const DAYS = 'days'
const PHOTOS = 'photos'

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(DAYS)) d.createObjectStore(DAYS, { keyPath: 'date' })
        if (!d.objectStoreNames.contains(PHOTOS)) d.createObjectStore(PHOTOS)
      },
    })
  }
  return dbPromise
}

export async function loadDay(date: string): Promise<DayRecord> {
  const found = (await (await db()).get(DAYS, date)) as DayRecord | undefined
  // Записи ранних версий не должны падать на полях, которых тогда не было.
  return found ? normalizeDay(found) : emptyDay(date)
}

export async function saveDay(day: DayRecord): Promise<DayRecord> {
  const next = { ...day, updatedAt: new Date().toISOString() }
  await (await db()).put(DAYS, next)
  return next
}

export async function listDayKeys(): Promise<string[]> {
  const keys = (await (await db()).getAllKeys(DAYS)) as string[]
  return keys.sort().reverse()
}

export async function listDays(): Promise<DayRecord[]> {
  const all = (await (await db()).getAll(DAYS)) as DayRecord[]
  return all.map(normalizeDay).sort((a, b) => b.date.localeCompare(a.date))
}

export async function deleteDay(date: string): Promise<void> {
  await (await db()).delete(DAYS, date)
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  await (await db()).put(PHOTOS, blob, id)
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return (await (await db()).get(PHOTOS, id)) as Blob | undefined
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete(PHOTOS, id)
}

/** Фото, на которые больше не ссылается ни одна запись, занимают место зря. */
export async function pruneOrphanPhotos(): Promise<number> {
  const d = await db()
  const days = (await d.getAll(DAYS)) as DayRecord[]
  const used = new Set<string>()
  for (const day of days) for (const meal of day.meals) if (meal.photoId) used.add(meal.photoId)
  const keys = (await d.getAllKeys(PHOTOS)) as string[]
  let removed = 0
  for (const key of keys) {
    if (!used.has(key)) {
      await d.delete(PHOTOS, key)
      removed++
    }
  }
  return removed
}
