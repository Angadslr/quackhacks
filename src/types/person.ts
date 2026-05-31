import type { NormalizedLandmark } from '../types/pose'
import type { SignalBreakdown } from './risk'
import type { RiskState } from './risk'

export interface TrackedPerson {
  id: number
  landmarks: NormalizedLandmark[]
  riskScore: number
  riskState: RiskState
  contributors: SignalBreakdown
  /** True when pose detection has been lost — score is extrapolated from last known state */
  isGhost?: boolean
  /** How long this person has been missing from the pose estimator (ms) */
  missingMs?: number
}
