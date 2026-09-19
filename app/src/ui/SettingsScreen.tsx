import { useState } from 'react'
import { useStore } from '../store'
import { testApiKey } from '../lib/ai'
import { testGithub } from '../lib/github'
import { pruneOrphanPhotos } from '../lib/db'
import { Field, Notice } from './common'

export function SettingsScreen() {
  const { settings, updateSettings, syncing, syncNow } = useStore()
  const [keyState, setKeyState] = useState<Check>({ kind: 'idle' })
  const [ghState, setGhState] = useState<Check>({ kind: 'idle' })
  const [showKey, setShowKey] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const check = async (set: (s: Check) => void, fn: () => Promise<string>) => {
    set({ kind: 'busy' })
    try {
      set({ kind: 'ok', text: await fn() })
    } catch (err) {
      set({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Настройки</h1>
      </div>

      <div className="content">
        <div className="card">
          <div className="card-title">Ключ Anthropic API</div>
          <Field
            label="API-ключ"
            hint="Ключ создаётся на console.anthropic.com → API Keys. Хранится только на этом устройстве и уходит напрямую в api.anthropic.com."
          >
            <div className="inline">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.anthropicApiKey}
                placeholder="sk-ant-..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => void updateSettings({ anthropicApiKey: e.target.value.trim() })}
              />
              <button className="btn sm" style={{ flex: 'none' }} onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </Field>

          <Field label="Модель" hint="Opus 5 разбирает фото точнее. Sonnet 5 дешевле и быстрее.">
            <select value={settings.model} onChange={(e) => void updateSettings({ model: e.target.value })}>
              <option value="claude-opus-5">Claude Opus 5 — точнее</option>
              <option value="claude-sonnet-5">Claude Sonnet 5 — дешевле</option>
            </select>
          </Field>

          <Field label="Тщательность разбора" hint="Выше — дольше думает и точнее считает, но дороже запрос.">
            <select
              value={settings.effort}
              onChange={(e) => void updateSettings({ effort: e.target.value as typeof settings.effort })}
            >
              <option value="low">Быстро</option>
              <option value="medium">Средне</option>
              <option value="high">Тщательно</option>
            </select>
          </Field>

          <button
            className="btn block"
            disabled={keyState.kind === 'busy' || !settings.anthropicApiKey}
            onClick={() => void check(setKeyState, () => testApiKey(settings))}
          >
            {keyState.kind === 'busy' ? <span className="spinner" /> : null} Проверить ключ
          </button>
          <CheckResult state={keyState} okPrefix="Ключ работает" />
        </div>

        <div className="card">
          <div className="card-title">Реестр в GitHub</div>
          <div className="small muted" style={{ marginBottom: 12 }}>
            Записи уезжают в репозиторий файлами <code>days/ГГГГ-ММ-ДД.json</code> — по файлу на сутки.
            Оттуда их может прочитать Claude и посчитать любую статистику.
          </div>

          <div className="inline">
            <Field label="Владелец">
              <input
                type="text"
                value={settings.github.owner}
                placeholder="koklish"
                autoCapitalize="off"
                onChange={(e) => void updateSettings({ github: { ...settings.github, owner: e.target.value.trim() } })}
              />
            </Field>
            <Field label="Репозиторий">
              <input
                type="text"
                value={settings.github.repo}
                placeholder="diabeton_days"
                autoCapitalize="off"
                onChange={(e) => void updateSettings({ github: { ...settings.github, repo: e.target.value.trim() } })}
              />
            </Field>
          </div>

          <Field label="Ветка">
            <input
              type="text"
              value={settings.github.branch}
              placeholder="main"
              autoCapitalize="off"
              onChange={(e) => void updateSettings({ github: { ...settings.github, branch: e.target.value.trim() } })}
            />
          </Field>

          <Field
            label="Токен доступа"
            hint="Fine-grained token на этот репозиторий с правом Contents: Read and write. Создаётся в GitHub → Settings → Developer settings → Personal access tokens."
          >
            <div className="inline">
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.github.token}
                placeholder="github_pat_..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => void updateSettings({ github: { ...settings.github, token: e.target.value.trim() } })}
              />
              <button className="btn sm" style={{ flex: 'none' }} onClick={() => setShowToken((v) => !v)}>
                {showToken ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </Field>

          <div className="switch">
            <span>Выгружать сразу после записи</span>
            <input
              type="checkbox"
              checked={settings.github.autoSync}
              onChange={(e) => void updateSettings({ github: { ...settings.github, autoSync: e.target.checked } })}
            />
          </div>
          <div className="switch">
            <span>
              Выгружать и фото
              <div className="small muted">Репозиторий будет расти примерно на 150–300 КБ за снимок.</div>
            </span>
            <input
              type="checkbox"
              checked={settings.github.uploadPhotos}
              onChange={(e) => void updateSettings({ github: { ...settings.github, uploadPhotos: e.target.checked } })}
            />
          </div>

          <div className="btn-row" style={{ marginTop: 8 }}>
            <button
              className="btn"
              disabled={ghState.kind === 'busy'}
              onClick={() => void check(setGhState, () => testGithub(settings))}
            >
              {ghState.kind === 'busy' ? <span className="spinner" /> : null} Проверить
            </button>
            <button className="btn primary" disabled={syncing} onClick={() => void syncNow()}>
              {syncing ? <span className="spinner" /> : null} Выгрузить всё
            </button>
          </div>
          <CheckResult state={ghState} okPrefix="" />
        </div>

        <div className="card">
          <div className="card-title">Расчёты</div>
          <div className="inline">
            <Field label="Граммов углеводов в 1 ХЕ">
              <input
                type="number"
                inputMode="numeric"
                value={settings.xeGrams}
                onChange={(e) => void updateSettings({ xeGrams: Math.max(1, Number(e.target.value) || 12) })}
              />
            </Field>
            <Field label="Цель по калориям">
              <input
                type="number"
                inputMode="numeric"
                value={settings.targetKcal}
                onChange={(e) => void updateSettings({ targetKcal: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
          </div>
          <div className="switch">
            <span>
              Считать ХЕ по усвояемым углеводам
              <div className="small muted">То есть за вычетом клетчатки. Классический счёт — по общим.</div>
            </span>
            <input
              type="checkbox"
              checked={settings.xeUseNetCarbs}
              onChange={(e) => void updateSettings({ xeUseNetCarbs: e.target.checked })}
            />
          </div>
          <div className="inline">
            <Field label="Цель по углеводам, г">
              <input
                type="number"
                inputMode="numeric"
                value={settings.targetCarbs}
                onChange={(e) => void updateSettings({ targetCarbs: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
          </div>
          <div className="inline">
            <Field label="Глюкоза: нижняя">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={settings.glucoseLow}
                onChange={(e) => void updateSettings({ glucoseLow: Number(e.target.value) || 4 })}
              />
            </Field>
            <Field label="Глюкоза: верхняя">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={settings.glucoseHigh}
                onChange={(e) => void updateSettings({ glucoseHigh: Number(e.target.value) || 8.5 })}
              />
            </Field>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>Постоянная схема препаратов</span>
            <button
              className="btn sm ghost"
              onClick={() =>
                void updateSettings({ medications: [...settings.medications, { name: '', dose: '', time: '08:00' }] })
              }
            >
              + Добавить
            </button>
          </div>
          {settings.medications.length === 0 && (
            <div className="empty">Схема пуста. Добавьте препараты, чтобы подставлять их в день одним нажатием.</div>
          )}
          {settings.medications.map((m, idx) => (
            <div className="row" key={idx} style={{ gap: 6 }}>
              <input
                type="time"
                value={m.time}
                style={{ width: 92, minHeight: 38 }}
                onChange={(e) => {
                  const next = [...settings.medications]
                  next[idx] = { ...m, time: e.target.value }
                  void updateSettings({ medications: next })
                }}
              />
              <input
                type="text"
                placeholder="Название"
                value={m.name}
                onChange={(e) => {
                  const next = [...settings.medications]
                  next[idx] = { ...m, name: e.target.value }
                  void updateSettings({ medications: next })
                }}
              />
              <input
                type="text"
                placeholder="Доза"
                style={{ width: 84 }}
                value={m.dose}
                onChange={(e) => {
                  const next = [...settings.medications]
                  next[idx] = { ...m, dose: e.target.value }
                  void updateSettings({ medications: next })
                }}
              />
              <button
                className="btn sm ghost danger"
                style={{ flex: 'none' }}
                onClick={() => void updateSettings({ medications: settings.medications.filter((_, i) => i !== idx) })}
                aria-label="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Контекст для ИИ</div>
          <Field
            label="Что модель должна знать о вас"
            hint="Этот текст уходит в каждый запрос: диагноз, препараты, ограничения, непереносимости."
          >
            <textarea
              value={settings.healthContext}
              onChange={(e) => void updateSettings({ healthContext: e.target.value })}
            />
          </Field>
        </div>

        <div className="card">
          <div className="card-title">Обслуживание</div>
          <button
            className="btn block"
            onClick={() => {
              void pruneOrphanPhotos().then((n) =>
                window.alert(n > 0 ? `Удалено неиспользуемых фото: ${n}` : 'Лишних фото не найдено'),
              )
            }}
          >
            Очистить неиспользуемые фото
          </button>
        </div>

        <div className="small muted" style={{ textAlign: 'center', paddingBottom: 8 }}>
          Приложение помогает вести учёт и не заменяет врача.
          <br />
          Решения о препаратах и дозах — только с лечащим врачом.
        </div>
      </div>
    </>
  )
}

type Check = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'err'; text: string }

function CheckResult({ state, okPrefix }: { state: Check; okPrefix: string }) {
  if (state.kind !== 'ok' && state.kind !== 'err') return null
  return (
    <div style={{ marginTop: 10 }}>
      <Notice kind={state.kind === 'ok' ? 'ok' : 'err'}>
        {state.kind === 'ok' ? [okPrefix, state.text].filter(Boolean).join(': ') : state.text}
      </Notice>
    </div>
  )
}
