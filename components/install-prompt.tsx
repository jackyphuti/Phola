'use client'

import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'phola-install-prompt-dismissed'
const AUTO_OPEN_DELAY_MS = 1200

function isIosBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const touchPoints = navigator.maxTouchPoints || 0

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
}

function isStandaloneApp() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1'
    const iosBrowser = isIosBrowser()

    setIsIos(iosBrowser)

    if (dismissed || isStandaloneApp()) {
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setOpen(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (iosBrowser) {
      setOpen(true)
    } else {
      const timer = window.setTimeout(() => {
        setOpen(true)
      }, AUTO_OPEN_DELAY_MS)

      return () => {
        window.clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  const handleInstall = async () => {
    if (!installPrompt) {
      dismiss()
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice
    window.sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
    setInstallPrompt(null)
  }

  const description = isIos
    ? 'iOS support is not available yet. Phola can be installed on Android and supported desktop browsers.'
    : installPrompt
      ? 'Install Phola to launch it like an app and keep it on your home screen.'
      : 'Your browser does not expose the install prompt yet. On supported browsers, use the browser menu to install Phola.'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          dismiss()
        } else {
          setOpen(true)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isIos ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
          <DialogTitle>{isIos ? 'iOS not supported yet' : 'Install Phola'}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={dismiss}>
            {isIos ? 'Close' : 'Not now'}
          </Button>
          {!isIos && (
            <Button type="button" onClick={handleInstall} disabled={!installPrompt}>
              Install App
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}