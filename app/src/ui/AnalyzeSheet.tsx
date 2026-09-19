import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { analysisToItems, analyzeMealPhoto, type MealAnalysis } from '../lib/ai'
import { takePhoto, type CapturedPhoto } from '../lib/photo'
import { putPhoto } from '../lib/db'
import { guessMealKind, nowTime, uid } from '../lib/date'
import { MEAL_KIND_RU, type FoodItem, type Meal, type MealKind } from '../types'
import { round, roundTotals, sumTotals, itemTotals } from '../lib/nutrition'
import { Field, Notice, Sheet } from './common'
import { ItemEditor } from './ItemEditor'

type Stage = 'pick' | 'working' | 'review'

export function AnalyzeSheet({ onClose }: { onClose: () => void }) {
  const { settings, day, commitDay, showToast } = useStore()
  const [stage, setStage] = useState<Stage>('pick')
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<MealKind>(guessMealKind(nowTime()))
  const [time, setTime] = useState(nowTime())
  const [note, setNote] = useState('')
  const [hint, setHint] = useState('')
  const [edited, setEdited] = useState(false)

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo.blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const run = useCallback(
    async (captured: CapturedPhoto, userHint: string) => {
      setStage('working')
      setError(null)
      try {
        const result = await analyzeMealPhoto({
          imageBase64: captured.base64,
          mediaType: captured.mediaType,
          hint: userHint,
          time,
          settings,
        })
        setAnalysis(result)
        setItems(analysisToItems(result))
        setTitle(result.mealTitle)
        setKind(result.mealKind)
        setEdited(false)
        setStage('review')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        // Снимок остаётся на экране: можно повторить разбор или дозаполнить руками.
        setStage('pick')
      }
    },
    [settings, time],
  )

  const capture = useCallback(
    async (source: 'camera' | 'gallery') => {
      setError(null)
      try {
        const captured = await takePhoto(source)
        if (!captured) return
        setPhoto(captured)
        await run(captured, hint)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [hint, run],
  )

  const save = useCallback(async () => {
    if (items.length === 0) {
      setError('Нечего сохранять: список блюд пуст.')
      return
    }
    let photoId: string | undefined
    if (photo) {
      photoId = uid()
      await putPhoto(photoId, photo.blob)
    }
    const meal: Meal = {
      id: uid(),
      time,
      kind,
      title: title.trim() || MEAL_KIND_RU[kind],
      photoId,
      items,
      note: note.trim() || undefined,
      source: analysis ? 'ai' : 'manual',
      model: analysis ? settings.model : undefined,
      editedByUser: edited,
      createdAt: new Date().toISOString(),
    }
    const meals = [...day.meals, meal].sort((a, b) => a.time.localeCompare(b.time))
    await commitDay({ ...day, meals })
    showToast('Приём пищи записан')
    onClose()
  }, [items, photo, time, kind, title, note, analysis, settings.model, edited, day, commitDay, showToast, onClose])

  const totals = roundTotals(sumTotals(items.map((i) => itemTotals(i, settings))))

  return (
    <Sheet title="Новый приём пищи" onClose={onClose}>
      {error && (
        <div style={{ marginBottom: 12 }}>
          <Notice kind="err">{error}</Notice>
        </div>
      )}

      {previewUrl && <img className="preview" src={previewUrl} alt="Снимок еды" style={{ marginBottom: 12 }} />}

      {stage === 'pick' && (
        <>
          {!settings.anthropicApiKey && (
            <div style={{ marginBottom: 12 }}>
              <Notice kind="info">
                Ключ Anthropic API не задан — фото не получится разобрать автоматически. Откройте
                «Настройки» и добавьте ключ, либо заполните блюда руками.
              </Notice>
            </div>
          )}
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button className="btn primary" onClick={() => void capture('camera')}>
              📷 Снять
            </button>
            <button className="btn" onClick={() => void capture('gallery')}>
              🖼 Из галереи
            </button>
          </div>
          {photo && (
            <button className="btn block" style={{ marginBottom: 10 }} onClick={() => void run(photo, hint)}>
              ↻ Разобрать этот снимок заново
            </button>
          )}
          <button
            className="btn ghost block"
            onClick={() => {
              setItems([])
              setAnalysis(null)
              setStage('review')
            }}
          >
            Добавить без фото
          </button>
        </>
      )}

      {stage === 'working' && (
        <div className="center-col">
          <div className="spinner" style={{ width: 26, height: 26 }} />
          <div>
            Разбираю снимок…
            <div className="small muted" style={{ marginTop: 4 }}>
              Обычно 15–40 секунд. Модель оценивает состав, вес порций и углеводы.
            </div>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <>
          <div className="inline" style={{ marginBottom: 12 }}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Время" />
            <select value={kind} onChange={(e) => setKind(e.target.value as MealKind)} aria-label="Приём пищи">
              {(Object.keys(MEAL_KIND_RU) as MealKind[]).map((k) => (
                <option key={k} value={k}>
                  {MEAL_KIND_RU[k]}
                </option>
              ))}
            </select>
          </div>

          <Field label="Название">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: гречка с курицей" />
          </Field>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">
              <span>Итог приёма</span>
              <span className="muted">{totals.grams} г</span>
            </div>
            <div className="totals">
              <div className="tot">
                <div className="v">{totals.kcal}</div>
                <div className="l">ккал</div>
              </div>
              <div className="tot">
                <div className="v">{round(totals.carbs)}</div>
                <div className="l">углеводы</div>
              </div>
              <div className="tot">
                <div className="v">{round(totals.xe, 1)}</div>
                <div className="l">ХЕ</div>
              </div>
              <div className="tot">
                <div className="v">{Math.round(totals.gl)}</div>
                <div className="l">гликем. нагр.</div>
              </div>
            </div>
          </div>

          {analysis?.diabetesNote && (
            <div style={{ marginBottom: 12 }}>
              <Notice kind="info">{analysis.diabetesNote}</Notice>
            </div>
          )}

          {analysis && analysis.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Notice kind="info">
                <b>Что снижает точность:</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {analysis.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">
              <span>Блюда</span>
              <span className="muted">{items.length}</span>
            </div>
            {items.length === 0 && <div className="empty">Ни одного блюда. Добавьте вручную.</div>}
            {items.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                settings={settings}
                onChange={(next) => {
                  setEdited(true)
                  setItems((list) => list.map((i) => (i.id === item.id ? next : i)))
                }}
                onRemove={() => {
                  setEdited(true)
                  setItems((list) => list.filter((i) => i.id !== item.id))
                }}
              />
            ))}
            <button
              className="btn sm ghost block"
              style={{ marginTop: 10 }}
              onClick={() => {
                setEdited(true)
                setItems((list) => [...list, blankItem()])
              }}
            >
              + Добавить блюдо
            </button>
          </div>

          {photo && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Уточнить и пересчитать</div>
              {analysis && analysis.questions.length > 0 && (
                <ul className="small muted" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                  {analysis.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Например: хлеб два куска по 30 г, чай без сахара, жарил на столовой ложке масла"
              />
              <button
                className="btn sm block"
                style={{ marginTop: 8 }}
                disabled={!hint.trim()}
                onClick={() => void run(photo, hint)}
              >
                Пересчитать с учётом уточнения
              </button>
            </div>
          )}

          <Field label="Заметка">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Самочувствие, обстоятельства, что не влезло в блюда" />
          </Field>

          <button className="btn primary block" onClick={() => void save()}>
            Сохранить в дневник
          </button>
        </>
      )}
    </Sheet>
  )
}

function blankItem(): FoodItem {
  return {
    id: uid(),
    name: '',
    grams: 100,
    per100: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
    gi: null,
    confidence: 'low',
  }
}
