import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { nowTime, uid } from '../lib/date'
import { CRAVING_OUTCOME_RU, type CravingEntry } from '../types'
import { Notice, Scale, Sheet } from './common'
import { VoiceButton } from './VoiceButton'

/** Помощь в момент тяги. Работает без интернета и без модели: когда накрывает,
 *  ждать ответа сети нельзя. Вся содержательная часть — из профиля. */
const WAVE_SECONDS = 15 * 60

const PRINCIPLES = [
  'Тяга — это волна. Пик проходит за 15–20 минут, дальше отпускает само.',
  'Не «никогда», а «не сегодня».',
  'Срыв — не провал. Возвращаюсь на следующем приёме, а не с понедельника.',
]

export function CravingSheet({ onClose }: { onClose: () => void }) {
  const { settings, day, commitDay, showToast } = useStore()
  const [step, setStep] = useState<'start' | 'wave' | 'close'>('start')
  const [intensity, setIntensity] = useState(7)
  const [trigger, setTrigger] = useState('')
  const [note, setNote] = useState('')
  const [left, setLeft] = useState(WAVE_SECONDS)
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    if (step !== 'wave') return
    const id = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => window.clearInterval(id)
  }, [step])

  const lastGlucose = useMemo(() => {
    if (day.glucose.length === 0) return null
    return day.glucose[day.glucose.length - 1]
  }, [day.glucose])

  const targets = settings.profile.targets
  const glucoseIsNormal =
    lastGlucose != null && lastGlucose.mmol >= targets.dayLow && lastGlucose.mmol <= targets.dayHigh

  const record = async (outcome: CravingEntry['outcome']) => {
    const entry: CravingEntry = {
      id: uid(),
      time: nowTime(),
      intensity,
      trigger: trigger.trim() || undefined,
      outcome,
      minutes: Math.round((Date.now() - startedAt) / 60000),
      glucoseAtStart: lastGlucose?.mmol,
      note: note.trim() || undefined,
    }
    await commitDay({ ...day, cravings: [...day.cravings, entry] })
    showToast(
      outcome === 'ate'
        ? 'Записано. Возвращаемся на следующем приёме.'
        : 'Записано. Это засчитывается в навык.',
    )
    onClose()
  }

  return (
    <Sheet title="Тянет" onClose={onClose}>
      {step === 'start' && (
        <>
          <Notice kind="info">
            {glucoseIsNormal ? (
              <>
                Последний сахар — {lastGlucose?.mmol.toFixed(1)} ммоль/л, это норма. Значит тело сыто,
                и это ложный голод: волна, а не потребность.
              </>
            ) : lastGlucose ? (
              <>Последний сахар — {lastGlucose.mmol.toFixed(1)} ммоль/л, измерен в {lastGlucose.time}.</>
            ) : (
              <>Сахар сегодня ещё не измерен. Если есть под рукой глюкометр — стоит измерить: это меняет картину.</>
            )}
          </Notice>

          <div style={{ marginTop: 14 }}>
            <Scale label="Насколько накрыло" value={intensity} onChange={setIntensity} />
          </div>

          <div className="field">
            <label>Что предшествовало</label>
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="стресс, скука, отпуск, усталость"
            />
            <VoiceButton onText={(t) => setTrigger((v) => (v ? `${v} ${t}` : t))} />
          </div>

          <button className="btn primary block" onClick={() => setStep('wave')}>
            Переждать волну — 15 минут
          </button>
          <div style={{ height: 8 }} />
          <button className="btn ghost block" onClick={() => setStep('close')}>
            Сразу записать, чем кончилось
          </button>
        </>
      )}

      {step === 'wave' && (
        <>
          <div className="timer" style={{ margin: '10px 0 4px' }}>
            {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
          </div>
          <div className="small muted" style={{ textAlign: 'center', marginBottom: 16 }}>
            {left > 0 ? 'Пик проходит примерно за это время' : 'Волна должна была отпустить'}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Пока ждём</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
              <li>Налей кофе или большой стакан воды.</li>
              <li>Выйди из кухни — в другую комнату или на улицу.</li>
              <li>Руки заняты — тяга слабее: помой посуду, разбери стол.</li>
            </ul>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Если всё-таки надо съесть</div>
            <div className="small muted" style={{ marginBottom: 8 }}>
              Это не поражение. Это выбор варианта, который не ломает режим.
            </div>
            <div className="chips">
              {settings.profile.prefs.safeSweets.map((s) => (
                <span className="chip key" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Твои же слова</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
              {PRINCIPLES.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>

          <button className="btn primary block" onClick={() => setStep('close')}>
            Записать, чем кончилось
          </button>
        </>
      )}

      {step === 'close' && (
        <>
          <div className="small muted" style={{ marginBottom: 12 }}>
            Любой исход записывается одинаково спокойно. Ничего не обнуляется.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['passed', 'safe_snack', 'ate'] as const).map((outcome) => (
              <button key={outcome} className="btn block" onClick={() => void record(outcome)}>
                {CRAVING_OUTCOME_RU[outcome]}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Заметка</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            <VoiceButton onText={(t) => setNote((v) => (v ? `${v} ${t}` : t))} />
          </div>
        </>
      )}
    </Sheet>
  )
}
