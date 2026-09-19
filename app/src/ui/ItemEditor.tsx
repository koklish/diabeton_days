import { useState } from 'react'
import type { FoodItem, Settings } from '../types'
import { itemTotals, round } from '../lib/nutrition'
import { ConfidenceChip } from './common'

export function ItemEditor({
  item,
  settings,
  onChange,
  onRemove,
}: {
  item: FoodItem
  settings: Settings
  onChange: (next: FoodItem) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const t = itemTotals(item, settings)

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
        <span className="chip key">{Math.round(t.kcal)} ккал</span>
        <span className="chip">У {round(t.carbs)} г</span>
        <span className="chip key">{round(t.xe, 1)} ХЕ</span>
        <span className="chip">Б {round(t.protein)}</span>
        <span className="chip">Ж {round(t.fat)}</span>
        {item.gi != null && <span className="chip">ГИ {item.gi}</span>}
        <ConfidenceChip level={item.confidence} />
      </div>

      {item.gramsMin != null && item.gramsMax != null && item.gramsMax > item.gramsMin && (
        <div className="small muted" style={{ marginBottom: 6 }}>
          Вероятный вес: {Math.round(item.gramsMin)}–{Math.round(item.gramsMax)} г
        </div>
      )}
      {item.assumption && (
        <div className="small muted" style={{ marginBottom: 6 }}>
          {item.assumption}
        </div>
      )}

      <div className="btn-row">
        <button className="btn sm ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Свернуть' : 'На 100 г'}
        </button>
        <button className="btn sm ghost danger" onClick={onRemove}>
          Удалить
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Значения на 100 г готового блюда
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
