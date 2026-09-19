import { useState } from 'react'
import { useStore } from '../store'
import { HAND_TRIGGERS, type HandsEntry } from '../types'
import { ChipPicker, Field, Notice, Scale, Sheet } from './common'
import { VoiceButton } from './VoiceButton'

/** Руки — обязательный раздел, а не опция. Отсюда берётся доказательная база
 *  для невролога и для МСЭ, где оценивают степень нарушения функции. */
export function HandsSheet({ onClose }: { onClose: () => void }) {
  const { day, commitDay, showToast } = useStore()
  const [entry, setEntry] = useState<HandsEntry>(
    day.hands ?? {
      numbness: 0,
      burning: 0,
      swelling: 0,
      weakness: 0,
      droppedThings: false,
      minutesToNumb: null,
      minutesToRecover: null,
      triggers: [],
    },
  )

  const patch = (p: Partial<HandsEntry>) => setEntry((e) => ({ ...e, ...p }))

  const save = async () => {
    await commitDay({ ...day, hands: entry })
    showToast('Записано')
    onClose()
  }

  return (
    <Sheet title="Руки" onClose={onClose}>
      <Scale label="Онемение" value={entry.numbness} onChange={(v) => patch({ numbness: v })} />
      <Scale label="Жжение" value={entry.burning} onChange={(v) => patch({ burning: v })} />
      <Scale label="Отёк" value={entry.swelling} onChange={(v) => patch({ swelling: v })} />
      <Scale label="Слабость" value={entry.weakness} onChange={(v) => patch({ weakness: v })} />

      <div className="switch">
        <span>
          Ронял предметы, кисть не слушалась
          <div className="small muted">Это отдельный признак — не то же самое, что онемение.</div>
        </span>
        <input
          type="checkbox"
          checked={entry.droppedThings}
          onChange={(e) => patch({ droppedThings: e.target.checked })}
        />
      </div>

      {(entry.weakness >= 4 || entry.droppedThings) && (
        <div style={{ margin: '10px 0' }}>
          <Notice kind="info">
            Слабость и потеря хвата — это про функцию, а не про усталость. Стоит показаться неврологу,
            а не переждать. Запись с датой здесь — уже половина аргумента.
          </Notice>
        </div>
      )}

      <div className="inline">
        <Field label="Затекает через, мин">
          <input
            type="number"
            inputMode="numeric"
            value={entry.minutesToNumb ?? ''}
            onChange={(e) => patch({ minutesToNumb: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <Field label="Проходит за, мин">
          <input
            type="number"
            inputMode="numeric"
            value={entry.minutesToRecover ?? ''}
            onChange={(e) => patch({ minutesToRecover: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
      </div>

      <Field label="Что провоцировало">
        <ChipPicker
          options={HAND_TRIGGERS}
          selected={entry.triggers}
          onToggle={(value) =>
            patch({
              triggers: entry.triggers.includes(value)
                ? entry.triggers.filter((t) => t !== value)
                : [...entry.triggers, value],
            })
          }
        />
      </Field>

      <Field label="Заметка">
        <textarea value={entry.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
        <VoiceButton onText={(t) => patch({ note: entry.note ? `${entry.note} ${t}` : t })} />
      </Field>

      <button className="btn primary block" onClick={() => void save()}>
        Сохранить
      </button>
    </Sheet>
  )
}
