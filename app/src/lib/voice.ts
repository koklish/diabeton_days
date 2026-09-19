import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { Capacitor } from '@capacitor/core'

/** Голосовой ввод. Владельцу тяжело печатать: руки затекают за минуту,
 *  поэтому голос — не удобство, а основной способ ввода текста.
 *  На устройстве работает системное распознавание Android, в браузере — Web Speech API. */

type WebRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

function webRecognitionCtor(): (new () => WebRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => WebRecognition
    webkitSpeechRecognition?: new () => WebRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export async function isVoiceAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await SpeechRecognition.available()
      return available
    } catch {
      return false
    }
  }
  return webRecognitionCtor() !== null
}

export interface VoiceSession {
  stop: () => void
}

export interface VoiceHandlers {
  /** Промежуточный текст — показывается, пока человек говорит. */
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
  onEnd?: () => void
}

export async function startVoice(handlers: VoiceHandlers): Promise<VoiceSession> {
  if (Capacitor.isNativePlatform()) return startNative(handlers)
  return startWeb(handlers)
}

async function startNative(handlers: VoiceHandlers): Promise<VoiceSession> {
  const permission = await SpeechRecognition.checkPermissions()
  if (permission.speechRecognition !== 'granted') {
    const asked = await SpeechRecognition.requestPermissions()
    if (asked.speechRecognition !== 'granted') {
      handlers.onError('Нужно разрешение на распознавание речи')
      return { stop: () => {} }
    }
  }

  const listener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
    const text = data.matches?.[0]
    if (text) handlers.onPartial?.(text)
  })

  let finished = false
  const finish = (text: string) => {
    if (finished) return
    finished = true
    void listener.remove()
    if (text.trim()) handlers.onFinal(text.trim())
    handlers.onEnd?.()
  }

  void SpeechRecognition.start({
    language: 'ru-RU',
    maxResults: 1,
    partialResults: true,
    popup: false,
  })
    .then((result: { matches?: string[] }) => finish(result?.matches?.[0] ?? ''))
    .catch((err: unknown) => {
      void listener.remove()
      handlers.onError(err instanceof Error ? err.message : 'Не удалось запустить распознавание')
      handlers.onEnd?.()
    })

  return {
    stop: () => {
      void SpeechRecognition.stop()
    },
  }
}

function startWeb(handlers: VoiceHandlers): VoiceSession {
  const Ctor = webRecognitionCtor()
  if (!Ctor) {
    handlers.onError('Этот браузер не умеет распознавать речь. Поставь APK — там работает системное распознавание.')
    handlers.onEnd?.()
    return { stop: () => {} }
  }
  const recognition = new Ctor()
  recognition.lang = 'ru-RU'
  recognition.continuous = false
  recognition.interimResults = true

  let last = ''
  recognition.onresult = (event) => {
    let text = ''
    for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
    last = text
    handlers.onPartial?.(text)
  }
  recognition.onerror = (event) => {
    handlers.onError(
      event.error === 'not-allowed' ? 'Доступ к микрофону запрещён' : 'Не получилось распознать речь',
    )
  }
  recognition.onend = () => {
    if (last.trim()) handlers.onFinal(last.trim())
    handlers.onEnd?.()
  }
  recognition.start()
  return { stop: () => recognition.stop() }
}
