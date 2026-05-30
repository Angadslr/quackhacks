export class AlertSound {
  private audioContext: AudioContext | null = null
  private intervalId: number | null = null

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  private beep(): void {
    const ctx = this.getContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'square'
    oscillator.frequency.value = 880
    gain.gain.value = 0.3

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.3)
  }

  start(): void {
    if (this.intervalId !== null) return
    void this.getContext().resume()
    this.beep()
    this.intervalId = window.setInterval(() => this.beep(), 600)
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  dispose(): void {
    this.stop()
    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }
  }
}
