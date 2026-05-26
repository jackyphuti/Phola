import { App } from '@capacitor/app'

const neutralDestination = 'https://weather.com'

export function safeExit() {
  if (typeof window === 'undefined') {
    return
  }

  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const isNative = Boolean(capacitor?.isNativePlatform?.())

  if (isNative) {
    void App.exitApp()
    return
  }

  window.location.replace(neutralDestination)
}
