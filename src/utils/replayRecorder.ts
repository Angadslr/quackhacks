import type { PersonFrame, PoseFrame, Incident } from '../types/pose'
import type { SignalBreakdown } from '../types/risk'

const BUFFER_DURATION_MS = 10_000
const MAX_FRAMES = 200

export class ReplayRecorder {
  private buffer: PoseFrame[] = []
  private incidents: Incident[] = []
  private highRiskStart: number | null = null

  pushFrame(
    timestamp: number,
    people: PersonFrame[],
    riskScore: number,
  ): void {
    const frame: PoseFrame = {
      timestamp,
      people: people.map((p) => ({
        bbox: p.bbox ? { ...p.bbox } : null,
        center: { ...p.center },
        isMissing: p.isMissing,
        riskScore: p.riskScore,
      })),
      riskScore,
    }

    this.buffer.push(frame)

    const cutoff = timestamp - BUFFER_DURATION_MS
    while (
      this.buffer.length > MAX_FRAMES ||
      (this.buffer[0]?.timestamp ?? 0) < cutoff
    ) {
      if (this.buffer.length <= 1) break
      this.buffer.shift()
    }
  }

  snapshotIncident(
    contributors: SignalBreakdown,
    peakRisk: number,
    personId?: number,
  ): Incident {
    const frames = this.buffer.map((f) => ({
      ...f,
      people: f.people.map((p) => ({
        bbox: p.bbox ? { ...p.bbox } : null,
        center: { ...p.center },
        isMissing: p.isMissing,
        riskScore: p.riskScore,
      })),
    }))

    const startTime = frames[0]?.timestamp ?? Date.now()
    const endTime = frames[frames.length - 1]?.timestamp ?? startTime

    const incident: Incident = {
      id: crypto.randomUUID(),
      startTime,
      peakRisk,
      durationMs: endTime - startTime,
      frames,
      contributors: { ...contributors },
      personId,
    }

    this.incidents.unshift(incident)
    return incident
  }

  getIncidents(): Incident[] {
    return [...this.incidents]
  }

  trackHighRiskDuration(timestamp: number, riskScore: number): number {
    if (riskScore > 65) {
      if (this.highRiskStart === null) {
        this.highRiskStart = timestamp
      }
      return timestamp - this.highRiskStart
    }
    this.highRiskStart = null
    return 0
  }

  resetHighRiskTracking(): void {
    this.highRiskStart = null
  }
}
