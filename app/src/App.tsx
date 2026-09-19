import { useState } from 'react'
import { useStore } from './store'
import { DayScreen } from './ui/DayScreen'
import { HistoryScreen } from './ui/HistoryScreen'
import { SettingsScreen } from './ui/SettingsScreen'

type Tab = 'day' | 'history' | 'settings'

export function App() {
  const { ready, toast, setDate } = useStore()
  const [tab, setTab] = useState<Tab>('day')

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
      {tab === 'history' && (
        <HistoryScreen
          onOpenDay={(date) => {
            setDate(date)
            setTab('day')
          }}
        />
      )}
      {tab === 'settings' && <SettingsScreen />}

      {toast && <div className={`toast ${toast.kind === 'err' ? 'err' : ''}`}>{toast.text}</div>}

      <nav className="tabbar">
        <button className={tab === 'day' ? 'on' : ''} onClick={() => setTab('day')}>
          <span className="ic">📖</span>
          Дневник
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          <span className="ic">📊</span>
          История
        </button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          <span className="ic">⚙️</span>
          Настройки
        </button>
      </nav>
    </div>
  )
}
