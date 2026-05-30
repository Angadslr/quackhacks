import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { SignalBreakdown } from './risk'
import type { RiskState } from './risk'

export interface TrackedPerson {
  id: number
  landmarks: NormalizedLandmark[]
  riskScore: number
  riskState: RiskState
  contributors: SignalBreakdown
}
