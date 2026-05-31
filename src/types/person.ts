import type { NormalizedBBox } from './detection'
import type { SignalBreakdown } from './risk'
import type { RiskState } from './risk'

export interface TrackedPerson {
  id: number
  bbox: NormalizedBBox | null
  confidence: number
  center: { x: number; y: number }
  isMissing: boolean
  /** Currently receiving detections this frame. */
  isTracked: boolean
  riskScore: number
  riskState: RiskState
  contributors: SignalBreakdown
}
