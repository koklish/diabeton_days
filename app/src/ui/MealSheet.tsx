import { useState } from 'react'
import { useStore } from '../store'
import { MEAL_KIND_RU, type Meal, type MealKind } from '../types'
import { derivePlate, mealTotals, round } from '../lib/nutrition'
import { uid } from '../lib/date'
import { deletePhoto } from '../lib/db'
import { Field, PhotoThumb, Sheet } from './common'
import { ItemEditor, blankItem } from './ItemEditor'
import { VerdictView, PlateView } from './VerdictView'
import { VoiceButton } from './VoiceButton'

export function MealSheet({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { day, commitDay, showToast } = useStore()
  const [draft, setDraft] = useState<Meal>(meal)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patch = (p: Partial<Meal>) => setDraft((d) => ({ ...d, ...p, editedByUser: true }))
  const patchItems = (items: Meal['items']) =>
    setDraft((d) => ({ ...d, items, plate: derivePlate(items, d.plate), editedByUser: true }))

  const save = async () => {
    const meals = day.meals
      .map((m) => (m.id === draft.id ? { ...draft, title: draft.title.trim() || MEAL_KIND_RU[draft.kind] } : m))
      .sort((a, b) => a.time.localeCompare(b.time))
    await commitDay({ ...day, meals })
    showToast('Сохранено')
    onClose()
  }

  const remove = async () => {
    if (meal.photoId) await deletePhoto(meal.photoId)
    await commitDay({
      ...day,
      meals: day.meals.filter((m) => m.id !== meal.id),
      // Замеры и прогулки, привязанные к удалённому приёму, остаются в дне,
      // но ссылку надо снять — иначе связь укажет в пустоту.
      glucose: day.glucose.map((g) => (g.mealId === meal.id ? { ...g, mealId: undefined } : g)),
      activity: day.activity.map((a) => (a.afterMealId === meal.id ? { ...a, afterMealId: undefined } : a)),
    })
    showToast('Удалено')
    onClose()
  }

  const totals = mealTotals(draft)

  return (
    <Sheet title="Приём пищи" onClose={onClose}>
      {draft.photoId && <PhotoThumb photoId={draft.photoId} className="preview" />}

      <div style={{ margin: '14px 0' }}>
        {draft.verdict ? <VerdictView verdict={draft.verdict} plate={draft.plate} /> : <PlateView plate={draft.plate} />}
      </div>

      <div className="inline" style={{ marginBottom: 12 }}>
        <input type="time" value={draft.time} onChange={(e) => patch({ time: e.target.value })} aria-label="Время" />
        <select
          value={draft.kind}
          onChange={(e) => patch({ kind: e.target.value as MealKind })}
          aria-label="Приём пищи"
        >
          {(Object.keys(MEAL_KIND_RU) as MealKind[]).map((k) => (
            <option key={k} value={k}>
              {MEAL_KIND_RU[k]}
            </option>
          ))}
        </select>
      </div>

      <Field label="Название">
        <input type="text" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
      </Field>

      <div className="switch">
        <span>Запланированный вкусный приём</span>
        <input
          type="checkbox"
          checked={draft.plannedTreat}
          onChange={(e) => patch({ plannedTreat: e.target.checked })}
        />
      </div>

      <div className="card" style={{ margin: '12px 0' }}>
        <div className="card-title">
          <span>Состав</span>
          <span className="muted">углеводы ~{round(totals.carbs)} г</span>
        </div>
        {draft.items.map((item) => (
          <ItemEditor
            key={item.id}
            item={item}
            onChange={(next) => patchItems(draft.items.map((i) => (i.id === item.id ? next : i)))}
            onRemove={() => patchItems(draft.items.filter((i) => i.id !== item.id))}
          />
        ))}
        <button
          className="btn sm ghost block"
          style={{ marginTop: 10 }}
          onClick={() => patchItems([...draft.items, blankItem(uid())])}
        >
          + Добавить
        </button>
      </div>

      <Field label="Заметка">
        <textarea value={draft.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
        <VoiceButton onText={(t) => patch({ note: draft.note ? `${draft.note} ${t}` : t })} />
      </Field>

      {draft.source === 'ai' && (
        <div className="small muted" style={{ marginBottom: 12 }}>
          Разобрано моделью {draft.model}. {draft.editedByUser ? 'Правлено вручную — этим цифрам доверия больше.' : ''}
        </div>
      )}

      <button className="btn primary block" onClick={() => void save()}>
        Сохранить
      </button>
      <div style={{ height: 8 }} />
      {confirmDelete ? (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
            Отмена
          </button>
          <button className="btn danger" onClick={() => void remove()}>
            Удалить
          </button>
        </div>
      ) : (
        <button className="btn ghost danger block" onClick={() => setConfirmDelete(true)}>
          Удалить приём
        </button>
      )}
    </Sheet>
  )
}
