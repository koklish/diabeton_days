import type { MealVerdict, Plate } from '../types'
import { VEG_SHARE_RU } from '../types'

/** Показ разбора. Порядок задан тем, что владельцу нужно увидеть за секунду:
 *  вердикт, структура тарелки, что ещё можно сделать. Победы стоят наравне
 *  с замечаниями, а не в конце мелким шрифтом. */
export function VerdictView({ verdict, plate }: { verdict: MealVerdict; plate: Plate }) {
  const ok = verdict.verdict === 'честно'
  return (
    <div>
      <div className="verdict">
        <span className={`mark ${ok ? 'ok' : 'no'}`}>{verdict.verdict}</span>
        <span className="why">{verdict.verdictReason}</span>
      </div>

      {verdict.isWin && (
        <div style={{ marginBottom: 10 }}>
          <span className="win-badge">★ Это победа</span>
        </div>
      )}

      <PlateView plate={plate} />

      <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.45 }}>{verdict.explanation}</p>

      {verdict.expectedCurve && (
        <div className="small muted" style={{ marginTop: 8 }}>
          Сахар: {verdict.expectedCurve}
        </div>
      )}

      {verdict.fix && (
        <div className="notice info" style={{ marginTop: 12 }}>
          <b>Что ещё можно сделать:</b> {verdict.fix}
        </div>
      )}

      {verdict.wins.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            В плюс
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45 }}>
            {verdict.wins.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict.basedOnPastMeals.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Из твоей истории
          </div>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {verdict.basedOnPastMeals.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict.warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>
            Что снижает точность
          </div>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {verdict.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function PlateView({ plate }: { plate: Plate }) {
  return (
    <div className="plate-row">
      <div className={`plate-cell ${plate.starches > 1 ? 'warn' : plate.starches === 1 ? '' : 'good'}`}>
        <div className="v">{plate.starches}</div>
        <div className="l">крахмалов</div>
      </div>
      <div className={`plate-cell ${plate.hasProtein ? 'good' : 'warn'}`}>
        <div className="v">{plate.hasProtein ? 'есть' : 'нет'}</div>
        <div className="l">белок</div>
      </div>
      <div
        className={`plate-cell ${
          plate.vegShare === 'half' || plate.vegShare === 'most' ? 'good' : plate.vegShare === 'none' ? 'warn' : ''
        }`}
      >
        <div className="v">{VEG_SHARE_RU[plate.vegShare]}</div>
        <div className="l">овощи</div>
      </div>
      {plate.hasSweet && (
        <div className="plate-cell">
          <div className="v">да</div>
          <div className="l">сладкое</div>
        </div>
      )}
    </div>
  )
}
