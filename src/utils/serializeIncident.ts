import type { Incident } from '../types/pose'
import type { SerializedIncident } from '../types/gemini'

export function serializeIncident(incident: Incident): SerializedIncident {
  const step = Math.max(1, Math.floor(incident.frames.length / 10))
  const riskTimeline = incident.frames
    .filter((_, i) => i % step === 0 || i === incident.frames.length - 1)
    .map((frame) => ({
      offsetMs: Math.round(frame.timestamp - incident.startTime),
      risk: Math.round(frame.riskScore),
      personCount: frame.people.length,
    }))

  const missingFrameCount = incident.frames.filter((f) =>
    f.people.some((p) => p.isMissing),
  ).length

  return {
    id: incident.id,
    peakRisk: Math.round(incident.peakRisk),
    durationSec: Math.round((incident.durationMs / 1000) * 10) / 10,
    personId: incident.personId,
    frameCount: incident.frames.length,
    contributors: { ...incident.contributors },
    riskTimeline,
    missingFrameCount,
  }
}
