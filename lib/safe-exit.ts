import { App } from '@capacitor/app'
import { clearSensitiveLocalData } from '@/lib/privacy'

const neutralDestination = 'https://weather.com'

export function safeExit() {
  if (typeof window === 'undefined') {
    return
  }

  clearSensitiveLocalData()

  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const isNative = Boolean(capacitor?.isNativePlatform?.())

  if (isNative) {
    void App.exitApp()
    return
  }

  window.location.replace(neutralDestination)
}
