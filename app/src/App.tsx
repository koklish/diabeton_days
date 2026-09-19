import { useState } from 'react'
import { useStore } from './store'
import { DayScreen } from './ui/DayScreen'
import { PatternsScreen } from './ui/PatternsScreen'
import { SettingsScreen } from './ui/SettingsScreen'
import { CravingSheet } from './ui/CravingSheet'

type Tab = 'day' | 'patterns' | 'settings'

export function App() {
  const { ready, toast } = useStore()
  const [tab, setTab] = useState<Tab>('day')
  const [craving, setCraving] = useState(false)

  if (!ready) {
    return (
      <div className="center-col" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'day' && <DayScreen />}
      {tab === 'patterns' && <PatternsScreen />}
      {tab === 'settings' && <SettingsScreen />}

      {toast && <div className={`toast ${toast.kind === 'err' ? 'err' : ''}`}>{toast.text}</div>}

      {/* Кнопка помощи при тяге доступна с любого экрана в одно касание:
          когда накрывает, искать её по вкладкам — уже поздно. */}
      {!craving && (
        <button className="craving-fab" onClick={() => setCraving(true)}>
          Тянет
        </button>
      )}
      {craving && <CravingSheet onClose={() => setCraving(false)} />}

      <nav className="tabbar">
        <button className={tab === 'day' ? 'on' : ''} onClick={() => setTab('day')}>
          <span className="ic">📖</span>
          День
        </button>
        <button className={tab === 'patterns' ? 'on' : ''} onClick={() => setTab('patterns')}>
          <span className="ic">🔗</span>
          Связи
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          <span className="ic">⚙️</span>
          Настройки
        </button>
      </nav>
    </div>
  )
}
