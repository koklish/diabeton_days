import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.koklish.diabetondays',
  appName: 'Diabeton Days',
  webDir: 'dist',
  android: {
    // Ключ и токен лежат в WebView-хранилище: без этого их сотрёт при очистке кэша.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Camera: {
      // Разрешения запрашиваются в момент первой съёмки, а не при запуске.
      androidScaleType: 'CENTER_CROP',
    },
  },
}

export default config
