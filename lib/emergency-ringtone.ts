/**
 * Emergency Ringtone and Audio Alarm Synthesizer.
 * Synthesizes a loud, urgent dual-tone emergency ring using the Web Audio API
 * so it works reliably on mobile and desktop without depending on external audio file downloads.
 */

class EmergencyRingtoneService {
  private audioCtx: AudioContext | null = null
  private isPlaying = false
  private loopIntervalId: any = null
  private vibrationIntervalId: any = null

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume()
    }
    return this.audioCtx
  }

  /**
   * Start ringing the loud emergency distress siren.
   */
  start(): void {
    if (this.isPlaying) return
    this.isPlaying = true

    const ctx = this.getAudioContext()

    const playBeep = (freq: number, duration: number, type: OscillatorType = 'sawtooth') => {
      if (!ctx || !this.isPlaying) return
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime)

        // Envelope: quick attack, sustained beep, quick release
        gain.gain.setValueAtTime(0.01, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration - 0.02)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + duration)
      } catch (err) {
        console.warn('[EmergencyRingtone] Play tone error:', err)
      }
    }

    // Play initial double urgent burst immediately
    playBeep(920, 0.22, 'sine')
    setTimeout(() => {
      if (this.isPlaying) playBeep(740, 0.22, 'sine')
    }, 240)

    // Siren loop: alternating two-tone emergency alarm cadence every 650ms
    let step = 0
    this.loopIntervalId = setInterval(() => {
      if (!this.isPlaying) return
      if (step % 2 === 0) {
        playBeep(940, 0.26, 'triangle')
      } else {
        playBeep(720, 0.26, 'sine')
      }
      step++
    }, 340)

    // Phone vibration pattern
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 800])
        this.vibrationIntervalId = setInterval(() => {
          if (!this.isPlaying) return
          navigator.vibrate([400, 200, 400, 200, 800])
        }, 2200)
      } catch {}
    }
  }

  /**
   * Stop the ringing alarm and vibration.
   */
  stop(): void {
    this.isPlaying = false
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId)
      this.loopIntervalId = null
    }
    if (this.vibrationIntervalId) {
      clearInterval(this.vibrationIntervalId)
      this.vibrationIntervalId = null
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0)
      } catch {}
    }
  }

  active(): boolean {
    return this.isPlaying
  }
}

export const emergencyRingtone = new EmergencyRingtoneService()
