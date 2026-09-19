import type { DayRecord, Settings } from '../types'
import { toExportJson, toIndexRow, type IndexRow } from './export'
import { getPhoto } from './db'
import { blobToBase64 } from './photo'

const API = 'https://api.github.com'

export class GithubError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'GithubError'
  }
}

function cfg(settings: Settings) {
  const { token, owner, repo, branch } = settings.github
  if (!token.trim()) throw new GithubError('Не задан токен GitHub. Откройте «Настройки».')
  if (!owner.trim() || !repo.trim()) throw new GithubError('Не указан репозиторий для синхронизации.')
  return { token: token.trim(), owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main' }
}

async function gh(settings: Settings, path: string, init: RequestInit = {}): Promise<Response> {
  const { token } = cfg(settings)
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  return res
}

/** UTF-8 -> base64. Прямой btoa ломается на кириллице. */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function getSha(settings: Settings, filePath: string): Promise<string | null> {
  const { owner, repo, branch } = cfg(settings)
  const res = await gh(settings, `/repos/${owner}/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`)
  if (res.status === 404) return null
  if (!res.ok) throw await ghError(res)
  const body = (await res.json()) as { sha?: string }
  return body.sha ?? null
}

function encodePath(filePath: string): string {
  return filePath.split('/').map(encodeURIComponent).join('/')
}

async function ghError(res: Response): Promise<GithubError> {
  let detail = ''
  try {
    const body = (await res.json()) as { message?: string }
    detail = body.message ?? ''
  } catch {
    detail = await res.text().catch(() => '')
  }
  if (res.status === 401) return new GithubError('Токен GitHub отклонён. Проверьте его в настройках.', 401)
  if (res.status === 403) return new GithubError(`Нет прав на запись в репозиторий. ${detail}`.trim(), 403)
  if (res.status === 404) return new GithubError('Репозиторий или ветка не найдены. Проверьте owner/repo/branch.', 404)
  if (res.status === 409) return new GithubError('Конфликт версий файла. Повторите синхронизацию.', 409)
  return new GithubError(`GitHub вернул ${res.status}. ${detail}`.trim(), res.status)
}

/** Загрузить один файл. Base64 передаём готовым, чтобы не гонять бинарь через строки дважды. */
async function putFile(
  settings: Settings,
  filePath: string,
  contentBase64: string,
  message: string,
): Promise<void> {
  const { owner, repo, branch } = cfg(settings)
  const sha = await getSha(settings, filePath)
  const res = await gh(settings, `/repos/${owner}/${repo}/contents/${encodePath(filePath)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) throw await ghError(res)
}

export async function pushDay(day: DayRecord, settings: Settings): Promise<void> {
  const json = JSON.stringify(toExportJson(day, settings), null, 2) + '\n'
  await putFile(settings, `days/${day.date}.json`, utf8ToBase64(json), `Дневник: ${day.date}`)

  if (settings.github.uploadPhotos) {
    for (const meal of day.meals) {
      if (!meal.photoId) continue
      const path = `photos/${day.date}/${meal.photoId}.jpg`
      // Фото не меняется после съёмки: если файл уже есть, второй раз не льём.
      if (await getSha(settings, path)) continue
      const blob = await getPhoto(meal.photoId)
      if (!blob) continue
      await putFile(settings, path, await blobToBase64(blob), `Фото: ${day.date} ${meal.time}`)
    }
  }
}

export async function pushIndex(days: DayRecord[], settings: Settings): Promise<void> {
  const rows: IndexRow[] = days
    .map((d) => toIndexRow(d, settings))
    .sort((a, b) => b.date.localeCompare(a.date))
  const payload = {
    generatedAt: new Date().toISOString(),
    xeGramsPerUnit: settings.xeGrams,
    dayCount: rows.length,
    days: rows,
  }
  await putFile(
    settings,
    'days/index.json',
    utf8ToBase64(JSON.stringify(payload, null, 2) + '\n'),
    'Дневник: обновление сводки',
  )
}

export interface SyncResult {
  pushed: number
  failed: { date: string; error: string }[]
}

export async function syncDays(days: DayRecord[], settings: Settings): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, failed: [] }
  for (const day of days) {
    try {
      await pushDay(day, settings)
      result.pushed++
    } catch (err) {
      result.failed.push({ date: day.date, error: err instanceof Error ? err.message : String(err) })
    }
  }
  if (result.pushed > 0) await pushIndex(days, settings)
  return result
}

/** Проверка доступа: существует ли репозиторий и есть ли право на запись. */
export async function testGithub(settings: Settings): Promise<string> {
  const { owner, repo, branch } = cfg(settings)
  const res = await gh(settings, `/repos/${owner}/${repo}`)
  if (!res.ok) throw await ghError(res)
  const body = (await res.json()) as { permissions?: { push?: boolean }; default_branch?: string }
  if (!body.permissions?.push) {
    throw new GithubError('Токен видит репозиторий, но не может в него писать. Нужно право Contents: write.')
  }
  const branchRes = await gh(settings, `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`)
  if (branchRes.status === 404) {
    throw new GithubError(`Ветка «${branch}» не найдена. Основная ветка репозитория: ${body.default_branch ?? '?'}.`)
  }
  if (!branchRes.ok) throw await ghError(branchRes)
  return `Доступ есть: ${owner}/${repo}, ветка ${branch}`
}
