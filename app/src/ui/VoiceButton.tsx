import { useEffect, useRef, useState } from 'react'
import { isVoiceAvailable, startVoice, type VoiceSession } from '../lib/voice'

/** Кнопка диктовки рядом с полем. Печатать владельцу тяжело, поэтому она
 *  стоит везде, где есть свободный текст. Услышанное дописывается к уже введённому. */
export function VoiceButton({
  onText,
  label = 'Продиктовать',
}: {
  onText: (text: string) => void
  label?: string
}) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const session = useRef<VoiceSession | null>(null)

  useEffect(() => {
    void isVoiceAvailable().then(setAvailable)
    return () => session.current?.stop()
  }, [])

  if (available === false) return null

  const toggle = async () => {
    if (listening) {
      session.current?.stop()
      return
    }
    setError(null)
    setPartial('')
    setListening(true)
    session.current = await startVoice({
      onPartial: setPartial,
      onFinal: (text) => onText(text),
      onError: (message) => setError(message),
      onEnd: () => {
        setListening(false)
        setPartial('')
      },
    })
  }

  return (
    <div>
      <button
        type="button"
        className={`btn sm ${listening ? 'primary' : 'ghost'}`}
        onClick={() => void toggle()}
        aria-label={label}
      >
        {listening ? '● Слушаю — нажми, чтобы закончить' : `🎤 ${label}`}
      </button>
      {partial && <div className="small muted" style={{ marginTop: 4 }}>{partial}</div>}
      {error && <div className="small" style={{ marginTop: 4, color: 'var(--red)' }}>{error}</div>}
    </div>
  )
}
