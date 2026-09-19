import { useState } from 'react'
import { useStore } from '../store'
import { MEAL_KIND_RU, type FoodItem, type Meal, type MealKind } from '../types'
import { itemTotals, round, roundTotals, sumTotals } from '../lib/nutrition'
import { uid } from '../lib/date'
import { deletePhoto } from '../lib/db'
import { Field, PhotoThumb, Sheet } from './common'
import { ItemEditor } from './ItemEditor'

export function MealSheet({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const { settings, day, commitDay, showToast } = useStore()
  const [draft, setDraft] = useState<Meal>(meal)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const totals = roundTotals(sumTotals(draft.items.map((i) => itemTotals(i, settings))))
  const patch = (p: Partial<Meal>) => setDraft((d) => ({ ...d, ...p, editedByUser: true }))

  const save = async () => {
    const meals = day.meals
      .map((m) => (m.id === draft.id ? { ...draft, title: draft.title.trim() || MEAL_KIND_RU[draft.kind] } : m))
      .sort((a, b) => a.time.localeCompare(b.time))
    await commitDay({ ...day, meals })
    showToast('Изменения сохранены')
    onClose()
  }

  const remove = async () => {
    if (meal.photoId) await deletePhoto(meal.photoId)
    await commitDay({ ...day, meals: day.meals.filter((m) => m.id !== meal.id) })
    showToast('Приём пищи удалён')
    onClose()
  }

  return (
    <Sheet title="Приём пищи" onClose={onClose}>
      {draft.photoId && (
        <PhotoThumb photoId={draft.photoId} className="preview" />
      )}

      <div className="inline" style={{ margin: '12px 0' }}>
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

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">
          <span>Блюда</span>
          <span className="muted">{draft.items.length}</span>
        </div>
        {draft.items.map((item) => (
          <ItemEditor
            key={item.id}
            item={item}
            settings={settings}
            onChange={(next) => patch({ items: draft.items.map((i) => (i.id === item.id ? next : i)) })}
            onRemove={() => patch({ items: draft.items.filter((i) => i.id !== item.id) })}
          />
        ))}
        <button
          className="btn sm ghost block"
          style={{ marginTop: 10 }}
          onClick={() => patch({ items: [...draft.items, blankItem()] })}
        >
          + Добавить блюдо
        </button>
      </div>

      <Field label="Заметка">
        <textarea value={draft.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
      </Field>

      {draft.source === 'ai' && (
        <div className="small muted" style={{ marginBottom: 12 }}>
          Разобрано моделью {draft.model}. {draft.editedByUser ? 'Цифры правлены вручную.' : ''}
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
            Удалить запись
          </button>
        </div>
      ) : (
        <button className="btn ghost danger block" onClick={() => setConfirmDelete(true)}>
          Удалить приём пищи
        </button>
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
