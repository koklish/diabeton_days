import { useState } from 'react'
import { useStore } from '../store'
import { testApiKey } from '../lib/ai'
import { testGithub } from '../lib/github'
import { pruneOrphanPhotos } from '../lib/db'
import type { Profile } from '../profile'
import { Card, Field, Notice } from './common'
import { VoiceButton } from './VoiceButton'

type Check = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'err'; text: string }

export function SettingsScreen() {
  const { settings, updateSettings, syncing, syncNow } = useStore()
  const [keyState, setKeyState] = useState<Check>({ kind: 'idle' })
  const [ghState, setGhState] = useState<Check>({ kind: 'idle' })
  const [showKey, setShowKey] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const profile = settings.profile
  const setProfile = (patch: Partial<Profile>) => updateSettings({ profile: { ...profile, ...patch } })
  const setList = (key: keyof Profile['prefs'], text: string) =>
    setProfile({
      prefs: { ...profile.prefs, [key]: text.split(',').map((s) => s.trim()).filter(Boolean) },
    })

  const checkKey = async () => {
    setKeyState({ kind: 'busy' })
    try {
      setKeyState({ kind: 'ok', text: await testApiKey(settings) })
    } catch (err) {
      setKeyState({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    }
  }

  const checkGithub = async () => {
    setGhState({ kind: 'busy' })
    try {
      const result = await testGithub(settings)
      updateSettings({ github: { ...settings.github, repoIsPublic: result.isPublic } })
      setGhState({ kind: 'ok', text: result.message })
    } catch (err) {
      setGhState({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Настройки</h1>
      </div>

      <div className="content">
        <Card title="Ключ Anthropic">
          <Field
            label="API-ключ"
            hint="Создаётся на console.anthropic.com → API Keys. Хранится только на этом телефоне и уходит напрямую в api.anthropic.com."
          >
            <div className="inline">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.anthropicApiKey}
                placeholder="sk-ant-..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => updateSettings({ anthropicApiKey: e.target.value.trim() })}
              />
              <button className="btn sm" style={{ flex: 'none' }} onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </Field>

          <div className="inline">
            <Field label="Модель">
              <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
                <option value="claude-opus-5">Opus 5 — точнее</option>
                <option value="claude-sonnet-5">Sonnet 5 — дешевле</option>
              </select>
            </Field>
            <Field label="Тщательность">
              <select
                value={settings.effort}
                onChange={(e) => updateSettings({ effort: e.target.value as typeof settings.effort })}
              >
                <option value="low">Быстро</option>
                <option value="medium">Средне</option>
                <option value="high">Тщательно</option>
              </select>
            </Field>
          </div>

          <button className="btn block" disabled={keyState.kind === 'busy' || !settings.anthropicApiKey} onClick={() => void checkKey()}>
            {keyState.kind === 'busy' ? <span className="spinner" /> : null} Проверить ключ
          </button>
          <CheckResult state={keyState} okPrefix="Ключ работает" />
        </Card>

        <Card title="Целевые цифры">
          <div className="inline">
            <Field label="Днём от">
              <NumInput value={profile.targets.dayLow} onChange={(v) => setProfile({ targets: { ...profile.targets, dayLow: v } })} />
            </Field>
            <Field label="Днём до">
              <NumInput value={profile.targets.dayHigh} onChange={(v) => setProfile({ targets: { ...profile.targets, dayHigh: v } })} />
            </Field>
          </div>
          <div className="inline">
            <Field label="Натощак до">
              <NumInput value={profile.targets.fastingHigh} onChange={(v) => setProfile({ targets: { ...profile.targets, fastingHigh: v } })} />
            </Field>
            <Field label="Лучшее от">
              <NumInput value={profile.targets.fastingBestLow} onChange={(v) => setProfile({ targets: { ...profile.targets, fastingBestLow: v } })} />
            </Field>
            <Field label="Лучшее до">
              <NumInput value={profile.targets.fastingBestHigh} onChange={(v) => setProfile({ targets: { ...profile.targets, fastingBestHigh: v } })} />
            </Field>
          </div>
          <div className="inline">
            <Field label="Пик норма до">
              <NumInput value={profile.targets.peakOk} onChange={(v) => setProfile({ targets: { ...profile.targets, peakOk: v } })} />
            </Field>
            <Field label="Разбирать от">
              <NumInput value={profile.targets.peakReview} onChange={(v) => setProfile({ targets: { ...profile.targets, peakReview: v } })} />
            </Field>
            <Field label="Гипо ниже">
              <NumInput value={profile.targets.hypo} onChange={(v) => setProfile({ targets: { ...profile.targets, hypo: v } })} />
            </Field>
          </div>
        </Card>

        <Card title="Еда">
          <Field label="Не ем" hint="Через запятую. Это не попадёт в предложения и разборы.">
            <textarea value={profile.prefs.excluded.join(', ')} onChange={(e) => setList('excluded', e.target.value)} />
          </Field>
          <Field label="Мой белок">
            <textarea value={profile.prefs.proteins.join(', ')} onChange={(e) => setList('proteins', e.target.value)} />
          </Field>
          <Field label="Мои овощи">
            <textarea value={profile.prefs.vegetables.join(', ')} onChange={(e) => setList('vegetables', e.target.value)} />
          </Field>
          <Field label="Мои гарниры">
            <textarea value={profile.prefs.starches.join(', ')} onChange={(e) => setList('starches', e.target.value)} />
          </Field>
          <Field label="Безопасное сладкое" hint="Показывается в момент тяги.">
            <textarea value={profile.prefs.safeSweets.join(', ')} onChange={(e) => setList('safeSweets', e.target.value)} />
          </Field>
        </Card>

        <Card
          title="Мои правила"
          action={
            <button
              className="btn sm ghost"
              onClick={() => setProfile({ rules: [...profile.rules, ''] })}
            >
              + Правило
            </button>
          }
        >
          <div className="small muted" style={{ marginBottom: 10 }}>
            На них опирается вердикт по каждому приёму.
          </div>
          {profile.rules.map((rule, idx) => (
            <div className="row" key={idx} style={{ gap: 6 }}>
              <input
                type="text"
                value={rule}
                onChange={(e) => {
                  const next = [...profile.rules]
                  next[idx] = e.target.value
                  setProfile({ rules: next })
                }}
              />
              <button
                className="btn sm ghost danger"
                style={{ flex: 'none' }}
                onClick={() => setProfile({ rules: profile.rules.filter((_, i) => i !== idx) })}
                aria-label="Убрать правило"
              >
                ✕
              </button>
            </div>
          ))}
        </Card>

        <Card
          title="Схема препаратов"
          action={
            <button
              className="btn sm ghost"
              onClick={() =>
                setProfile({
                  meds: [
                    ...profile.meds,
                    { id: Math.random().toString(36).slice(2), name: '', dose: '', time: '08:00', kind: 'other', schedule: 'daily' },
                  ],
                })
              }
            >
              + Препарат
            </button>
          }
        >
          {profile.meds.map((m, idx) => (
            <div className="row" key={m.id} style={{ gap: 6 }}>
              <input
                type="time"
                value={m.time}
                style={{ width: 92, minHeight: 40 }}
                aria-label={`Время: ${m.name}`}
                onChange={(e) => {
                  const next = [...profile.meds]
                  next[idx] = { ...m, time: e.target.value }
                  setProfile({ meds: next })
                }}
              />
              <input
                type="text"
                placeholder="Название"
                value={m.name}
                onChange={(e) => {
                  const next = [...profile.meds]
                  next[idx] = { ...m, name: e.target.value }
                  setProfile({ meds: next })
                }}
              />
              <input
                type="text"
                placeholder="Доза"
                style={{ width: 88 }}
                value={m.dose}
                onChange={(e) => {
                  const next = [...profile.meds]
                  next[idx] = { ...m, dose: e.target.value }
                  setProfile({ meds: next })
                }}
              />
              <button
                className="btn sm ghost danger"
                style={{ flex: 'none' }}
                onClick={() => setProfile({ meds: profile.meds.filter((_, i) => i !== idx) })}
                aria-label="Убрать"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="small muted" style={{ marginTop: 10 }}>
            Дозы не заполнены — впиши свои. Приложение их не назначает и не меняет.
          </div>
        </Card>

        <Card title="Что модель знает обо мне">
          <Field label="Диагноз и обстоятельства">
            <textarea value={profile.diagnosis} onChange={(e) => setProfile({ diagnosis: e.target.value })} />
          </Field>
          <Field label="Зачем это всё" hint="Задаёт смысл разбора: ради чего делаются выборы.">
            <textarea value={profile.priority} onChange={(e) => setProfile({ priority: e.target.value })} />
          </Field>
          <Field label="Дополнительно">
            <textarea value={profile.extraContext} onChange={(e) => setProfile({ extraContext: e.target.value })} />
            <VoiceButton onText={(t) => setProfile({ extraContext: profile.extraContext ? `${profile.extraContext} ${t}` : t })} />
          </Field>
        </Card>

        <Card title="Реестр в GitHub">
          {settings.github.repoIsPublic === true && (
            <div style={{ marginBottom: 12 }}>
              <Notice kind="err">
                Этот репозиторий <b>публичный</b>. Дневник питания, сахара, состояния и рук —
                медицинские данные, и они будут видны всем. Заведи приватный репозиторий
                и укажи его здесь.
              </Notice>
            </div>
          )}

          <div className="small muted" style={{ marginBottom: 12 }}>
            Записи уезжают файлами <code>days/ГГГГ-ММ-ДД.json</code> — по файлу на сутки.
            Оттуда их читают Claude и ты сам с любого устройства.
          </div>

          <div className="inline">
            <Field label="Владелец">
              <input
                type="text"
                value={settings.github.owner}
                placeholder="koklish"
                autoCapitalize="off"
                onChange={(e) => updateSettings({ github: { ...settings.github, owner: e.target.value.trim(), repoIsPublic: null } })}
              />
            </Field>
            <Field label="Репозиторий">
              <input
                type="text"
                value={settings.github.repo}
                placeholder="diabeton_diary"
                autoCapitalize="off"
                onChange={(e) => updateSettings({ github: { ...settings.github, repo: e.target.value.trim(), repoIsPublic: null } })}
              />
            </Field>
          </div>

          <Field label="Ветка">
            <input
              type="text"
              value={settings.github.branch}
              placeholder="main"
              autoCapitalize="off"
              onChange={(e) => updateSettings({ github: { ...settings.github, branch: e.target.value.trim() } })}
            />
          </Field>

          <Field
            label="Токен"
            hint="Fine-grained token на этот репозиторий с правом Contents: Read and write."
          >
            <div className="inline">
              <input
                type={showToken ? 'text' : 'password'}
                value={settings.github.token}
                placeholder="github_pat_..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => updateSettings({ github: { ...settings.github, token: e.target.value.trim() } })}
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
              onChange={(e) => updateSettings({ github: { ...settings.github, autoSync: e.target.checked } })}
            />
          </div>
          <div className="switch">
            <span>
              Выгружать и фото
              <div className="small muted">Примерно 150–300 КБ за снимок.</div>
            </span>
            <input
              type="checkbox"
              checked={settings.github.uploadPhotos}
              onChange={(e) => updateSettings({ github: { ...settings.github, uploadPhotos: e.target.checked } })}
            />
          </div>

          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={ghState.kind === 'busy'} onClick={() => void checkGithub()}>
              {ghState.kind === 'busy' ? <span className="spinner" /> : null} Проверить
            </button>
            <button className="btn primary" disabled={syncing} onClick={() => void syncNow()}>
              {syncing ? <span className="spinner" /> : null} Выгрузить всё
            </button>
          </div>
          <CheckResult state={ghState} okPrefix="" />
        </Card>

        <Card title="Обслуживание">
          <button
            className="btn block"
            onClick={() =>
              void pruneOrphanPhotos().then((n) =>
                window.alert(n > 0 ? `Удалено неиспользуемых фото: ${n}` : 'Лишних фото не найдено'),
              )
            }
          >
            Очистить неиспользуемые фото
          </button>
        </Card>

        <div className="small muted" style={{ textAlign: 'center', paddingBottom: 8, lineHeight: 1.5 }}>
          Приложение собирает данные и помогает задать правильный вопрос врачу.
          <br />
          Оно не ставит диагнозов и не меняет дозы.
        </div>
      </div>
    </>
  )
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.1"
      value={value}
      onChange={(e) => onChange(Number(e.target.value.replace(',', '.')) || 0)}
    />
  )
}

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
