export type RiskState = 'SAFE' | 'CAUTION' | 'DISTRESS' | 'CRITICAL'

export interface SignalBreakdown {
  submersion: number
  stasis: number
  disappearance: number
  distress: number
}

export interface SerializedIncident {
  id: string
  peakRisk: number
  durationSec: number
  personId?: number
  frameCount: number
  contributors: SignalBreakdown
  riskTimeline: { offsetMs: number; risk: number; personCount: number }[]
  missingFrameCount: number
}

export interface IncidentBriefingRequest {
  riskScore: number
  riskState: RiskState
  contributors: SignalBreakdown
  personId: number | null
  highRiskDurationMs: number
  timeline: { message: string; kind: string; time: string }[]
  incident: SerializedIncident | null
}

export interface IncidentBriefingResponse {
  briefing: string
  incidentSummary: string
}
