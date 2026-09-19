import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../store'
import { analysisToVerdict, analyzeMeal, type MealAnalysis } from '../lib/ai'
import { takePhoto, type CapturedPhoto } from '../lib/photo'
import { putPhoto } from '../lib/db'
import { guessMealKind, nowTime, uid } from '../lib/date'
import { MEAL_KIND_RU, type FoodItem, type Meal, type MealKind, type Plate } from '../types'
import { derivePlate, mealTotals, round } from '../lib/nutrition'
import { Field, Notice, Sheet } from './common'
import { ItemEditor, blankItem } from './ItemEditor'
import { VerdictView, PlateView } from './VerdictView'
import { VoiceButton } from './VoiceButton'
import { analysisToMealDraft } from './analyzeHelpers'

type Stage = 'pick' | 'working' | 'review'

export function AnalyzeSheet({ onClose }: { onClose: () => void }) {
  const { settings, day, days, commitDay, showToast } = useStore()
  const [stage, setStage] = useState<Stage>('pick')
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null)
  const [items, setItems] = useState<FoodItem[]>([])
  const [plate, setPlate] = useState<Plate>({
    starches: 0, hasProtein: false, vegShare: 'none', hasSweet: false, proteinFirst: null,
  })
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<MealKind>(guessMealKind(nowTime()))
  const [time, setTime] = useState(nowTime())
  const [note, setNote] = useState('')
  const [hint, setHint] = useState('')
  const [description, setDescription] = useState('')
  const [plannedTreat, setPlannedTreat] = useState(false)
  const [edited, setEdited] = useState(false)

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo.blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  /** Последний известный сахар: без него разбор слеп, а замер обычно только что сделан. */
  const lastGlucose = day.glucose.length > 0 ? day.glucose[day.glucose.length - 1].mmol : null

  const run = useCallback(
    async (captured: CapturedPhoto | null, userHint: string, text: string) => {
      setStage('working')
      setError(null)
      try {
        const result = await analyzeMeal({
          imageBase64: captured?.base64,
          mediaType: captured?.mediaType,
          description: text,
          hint: userHint,
          time,
          settings,
          history: days,
          currentGlucose: lastGlucose,
          plannedTreat,
        })
        const draft = analysisToMealDraft(result)
        setAnalysis(result)
        setItems(draft.items)
        setPlate(draft.plate)
        setTitle(draft.title)
        setKind(draft.kind)
        setEdited(false)
        setStage('review')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setStage('pick')
      }
    },
    [settings, time, days, lastGlucose, plannedTreat],
  )

  const capture = useCallback(
    async (source: 'camera' | 'gallery') => {
      setError(null)
      try {
        const captured = await takePhoto(source)
        if (!captured) return
        setPhoto(captured)
        await run(captured, hint, description)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [hint, description, run],
  )

  const updateItems = useCallback((next: FoodItem[]) => {
    setEdited(true)
    setItems(next)
    // Структура тарелки пересчитывается сразу: вердикт опирался на неё,
    // и после правки состава она не должна врать.
    setPlate((prev) => derivePlate(next, prev))
  }, [])

  const save = useCallback(async () => {
    if (items.length === 0) {
      setError('Нечего сохранять: список пуст.')
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
      plate,
      verdict: analysis ? analysisToVerdict(analysis) : undefined,
      note: note.trim() || undefined,
      source: analysis ? 'ai' : 'manual',
      model: analysis ? settings.model : undefined,
      editedByUser: edited,
      plannedTreat,
      createdAt: new Date().toISOString(),
    }
    await commitDay({ ...day, meals: [...day.meals, meal].sort((a, b) => a.time.localeCompare(b.time)) })
    showToast('Записано')
    onClose()
  }, [items, photo, time, kind, title, plate, analysis, note, settings.model, edited, plannedTreat, day, commitDay, showToast, onClose])

  const totals = mealTotals({ items } as Meal)

  return (
    <Sheet title="Приём пищи" onClose={onClose}>
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
                Ключ Anthropic не задан — разобрать фото нечем. Добавь его в «Настройках» или заполни руками.
              </Notice>
            </div>
          )}

          <div className="switch" style={{ marginBottom: 6 }}>
            <span>
              Запланированный вкусный приём
              <div className="small muted">Часть системы, а не нарушение. Разбор будет без осуждения.</div>
            </span>
            <input type="checkbox" checked={plannedTreat} onChange={(e) => setPlannedTreat(e.target.checked)} />
          </div>

          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button className="btn primary" onClick={() => void capture('camera')}>
              📷 Снять
            </button>
            <button className="btn" onClick={() => void capture('gallery')}>
              🖼 Из галереи
            </button>
          </div>

          {photo && (
            <button className="btn block" style={{ marginBottom: 10 }} onClick={() => void run(photo, hint, description)}>
              ↻ Разобрать снимок заново
            </button>
          )}

          <Field label="Или расскажи словами" hint="Если фото нет или на нём не всё видно.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Куриное бедро, салат из огурцов, кофе без сахара"
            />
            <VoiceButton onText={(t) => setDescription((v) => (v ? `${v} ${t}` : t))} />
          </Field>

          <div className="btn-row">
            <button
              className="btn"
              disabled={!description.trim()}
              onClick={() => void run(null, hint, description)}
            >
              Разобрать по описанию
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setItems([])
                setAnalysis(null)
                setStage('review')
              }}
            >
              Заполнить руками
            </button>
          </div>
        </>
      )}

      {stage === 'working' && (
        <div className="center-col">
          <div className="spinner" style={{ width: 26, height: 26 }} />
          <div>
            Разбираю…
            <div className="small muted" style={{ marginTop: 4 }}>
              Обычно 20–40 секунд. Смотрю состав, вес порций и твою историю по похожим приёмам.
            </div>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <>
          {analysis ? (
            <div style={{ marginBottom: 14 }}>
              <VerdictView verdict={analysisToVerdict(analysis)} plate={plate} />
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <PlateView plate={plate} />
            </div>
          )}

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
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">
              <span>Состав</span>
              <span className="muted">углеводы ~{round(totals.carbs)} г</span>
            </div>
            {items.length === 0 && <div className="empty">Пусто. Добавь позицию.</div>}
            {items.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                onChange={(next) => updateItems(items.map((i) => (i.id === item.id ? next : i)))}
                onRemove={() => updateItems(items.filter((i) => i.id !== item.id))}
              />
            ))}
            <button
              className="btn sm ghost block"
              style={{ marginTop: 10 }}
              onClick={() => updateItems([...items, blankItem(uid())])}
            >
              + Добавить
            </button>
          </div>

          {(photo || description) && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Уточнить и пересчитать</div>
              {analysis && analysis.questions.length > 0 && (
                <ul className="small muted" style={{ margin: '0 0 8px', paddingLeft: 18, lineHeight: 1.5 }}>
                  {analysis.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Хлеб два куска по 30 г, жарил на ложке масла, чай без сахара"
              />
              <div style={{ marginTop: 8 }}>
                <VoiceButton onText={(t) => setHint((v) => (v ? `${v} ${t}` : t))} />
              </div>
              <button
                className="btn sm block"
                style={{ marginTop: 8 }}
                disabled={!hint.trim()}
                onClick={() => void run(photo, hint, description)}
              >
                Пересчитать
              </button>
            </div>
          )}

          <Field label="Заметка">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            <VoiceButton onText={(t) => setNote((v) => (v ? `${v} ${t}` : t))} />
          </Field>

          <button className="btn primary block" onClick={() => void save()}>
            Записать
          </button>
        </>
      )}
    </Sheet>
  )
}
