import { useMemo } from 'react'
import { useStore } from '../store'
import { findPatterns, type Finding } from '../lib/patterns'
import { Card } from './common'

const KIND_LABEL: Record<Finding['kind'], string> = {
  safety: 'Безопасность',
  pattern: 'Связь',
  win: 'Победы',
  question: 'Вопрос',
}

const DOCTOR_LABEL: Record<NonNullable<Finding['forDoctor']>, string> = {
  endocrinologist: 'эндокринологу',
  neurologist: 'неврологу',
  psychiatrist: 'психиатру',
  gastro: 'гастроэнтерологу',
}

/** Находки считаются на устройстве из самих записей. Никакой модели здесь нет:
 *  это арифметика по его собственным цифрам, и она должна быть проверяемой. */
export function PatternsScreen() {
  const { days, settings, syncing, syncNow } = useStore()
  const findings = useMemo(() => findPatterns(days, settings.profile), [days, settings.profile])

  const groups: Finding['kind'][] = ['safety', 'win', 'pattern', 'question']
  const measured = days.reduce((a, d) => a + d.glucose.length, 0)

  return (
    <>
      <div className="topbar">
        <h1>
          Связи
          <span className="sub">
            {days.length} дней, {measured} замеров
          </span>
        </h1>
        <button className="icon-btn" onClick={() => void syncNow()} disabled={syncing} aria-label="Выгрузить">
          {syncing ? <span className="spinner" /> : '☁'}
        </button>
      </div>

      <div className="content">
        {findings.length === 0 && (
          <div className="card">
            <div className="empty">
              Пока данных мало. Связи появятся, когда наберётся несколько приёмов с замерами сахара
              до и после — три-четыре дня обычно хватает, чтобы что-то проступило.
            </div>
          </div>
        )}

        {groups.map((kind) => {
          const list = findings.filter((f) => f.kind === kind)
          if (list.length === 0) return null
          return (
            <Card key={kind} title={KIND_LABEL[kind]}>
              {list.map((f) => (
                <div className="finding" key={f.id}>
                  <div className="ft">{f.title}</div>
                  <div className="fx">{f.text}</div>
                  <div className="fm">
                    <span className="chip">{f.strength}</span>
                    <span className="chip">{f.n} наблюдений</span>
                    {f.forDoctor && <span className="chip key">к {DOCTOR_LABEL[f.forDoctor]}</span>}
                  </div>
                </div>
              ))}
            </Card>
          )
        })}

        {findings.length > 0 && (
          <div className="small muted" style={{ textAlign: 'center', padding: '4px 10px 8px', lineHeight: 1.5 }}>
            «Намёк» — меньше пяти наблюдений, такому выводу верить рано.
            <br />
            Это арифметика по твоим записям, а не медицинское заключение.
          </div>
        )}
      </div>
    </>
  )
}
