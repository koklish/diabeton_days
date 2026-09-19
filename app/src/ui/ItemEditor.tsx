import { useState } from 'react'
import { FOOD_ROLE_RU, type FoodItem, type FoodRole } from '../types'
import { itemTotals, round } from '../lib/nutrition'
import { ConfidenceChip } from './common'

/** Редактор позиции. Наверху — роль и бытовая порция: именно так владелец
 *  думает о еде. Цифры на 100 г спрятаны под «подробно» — они нужны редко. */
export function ItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: FoodItem
  onChange: (next: FoodItem) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const t = itemTotals(item)

  const setPer100 = (key: keyof FoodItem['per100'], value: number) =>
    onChange({ ...item, per100: { ...item.per100, [key]: value } })

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
      <div className="inline" style={{ marginBottom: 6 }}>
        <input
          type="text"
          value={item.name}
          aria-label="Название"
          onChange={(e) => onChange({ ...item, name: e.target.value })}
        />
        <select
          className="narrow"
          value={item.role}
          aria-label="Роль в тарелке"
          onChange={(e) => onChange({ ...item, role: e.target.value as FoodRole })}
        >
          {(Object.keys(FOOD_ROLE_RU) as FoodRole[]).map((r) => (
            <option key={r} value={r}>
              {FOOD_ROLE_RU[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="inline" style={{ marginBottom: 6 }}>
        <input
          type="text"
          value={item.portion}
          aria-label="Порция"
          placeholder="с кулак / две ложки"
          onChange={(e) => onChange({ ...item, portion: e.target.value })}
        />
        <div className="narrow inline" style={{ gap: 4 }}>
          <input
            type="number"
            inputMode="numeric"
            value={Math.round(item.grams)}
            aria-label="Вес в граммах"
            onChange={(e) => onChange({ ...item, grams: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="muted small" style={{ flex: 'none' }}>
            г
          </span>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 6 }}>
        <span className="chip key">углеводы {round(t.carbs)} г</span>
        {item.gi != null && <span className="chip">ГИ {item.gi}</span>}
        <span className="chip">{Math.round(t.kcal)} ккал</span>
        <ConfidenceChip level={item.confidence} />
      </div>

      {item.gramsMin != null && item.gramsMax != null && item.gramsMax > item.gramsMin && (
        <div className="small muted" style={{ marginBottom: 6 }}>
          Вероятный вес: {Math.round(item.gramsMin)}–{Math.round(item.gramsMax)} г
        </div>
      )}
      {item.note && (
        <div className="small muted" style={{ marginBottom: 6 }}>
          {item.note}
        </div>
      )}

      <div className="btn-row">
        <button className="btn sm ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Свернуть' : 'Подробно'}
        </button>
        <button className="btn sm ghost danger" onClick={onRemove}>
          Убрать
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            На 100 г готового блюда
          </div>
          <div className="inline" style={{ marginBottom: 8 }}>
            <NumBox label="ккал" value={item.per100.kcal} onChange={(v) => setPer100('kcal', v)} />
            <NumBox label="белки" value={item.per100.protein} onChange={(v) => setPer100('protein', v)} />
            <NumBox label="жиры" value={item.per100.fat} onChange={(v) => setPer100('fat', v)} />
          </div>
          <div className="inline">
            <NumBox label="углеводы" value={item.per100.carbs} onChange={(v) => setPer100('carbs', v)} />
            <NumBox label="клетчатка" value={item.per100.fiber} onChange={(v) => setPer100('fiber', v)} />
            <NumBox
              label="ГИ"
              value={item.gi ?? 0}
              onChange={(v) => onChange({ ...item, gi: v > 0 ? v : null })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function NumBox({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="small muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={round(value, 1)}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </label>
  )
}

export function blankItem(id: string): FoodItem {
  return {
    id,
    name: '',
    role: 'protein',
    portion: '',
    grams: 100,
    per100: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
    gi: null,
    confidence: 'low',
  }
}
