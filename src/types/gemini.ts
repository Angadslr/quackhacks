import type { Incident } from './pose'
import type { RiskState, SignalBreakdown } from './risk'
import type { TimelineEventKind } from './timeline'

/** Compact incident stats sent to Gemini (no raw video). */
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
  timeline: { message: string; kind: TimelineEventKind; time: string }[]
  incident: SerializedIncident | null
}

export interface IncidentBriefingResponse {
  briefing: string
  incidentSummary: string
}

export type { Incident }
