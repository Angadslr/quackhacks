export type RiskState = 'SAFE' | 'CAUTION' | 'DISTRESS' | 'CRITICAL'

export interface SignalBreakdown {
  submersion: number
  stasis: number
  disappearance: number
  distress: number
}

export interface RiskResult {
  score: number
  state: RiskState
  contributors: SignalBreakdown
}

export interface DetectionHistoryEntry {
  timestamp: number
  bbox: import('./detection').NormalizedBBox
  confidence: number
  center: { x: number; y: number }
}

export function getRiskState(score: number): RiskState {
  if (score >= 85) return 'CRITICAL'
  if (score >= 65) return 'DISTRESS'
  if (score >= 40) return 'CAUTION'
  return 'SAFE'
}

export function getSkeletonColor(state: RiskState): string {
  switch (state) {
    case 'SAFE':
      return '#38bdf8'
    case 'CAUTION':
      return '#fbbf24'
    case 'DISTRESS':
    case 'CRITICAL':
      return '#dc2626'
  }
}

export function getStateTailwind(state: RiskState): {
  text: string
  border: string
  bg: string
} {
  switch (state) {
    case 'SAFE':
      return {
        text: 'text-guard-pool',
        border: 'border-guard-pool',
        bg: 'bg-guard-pool/10',
      }
    case 'CAUTION':
      return {
        text: 'text-guard-yellow',
        border: 'border-guard-yellow',
        bg: 'bg-guard-yellow/10',
      }
    case 'DISTRESS':
      return {
        text: 'text-guard-red',
        border: 'border-guard-red',
        bg: 'bg-guard-red/10',
      }
    case 'CRITICAL':
      return {
        text: 'text-guard-red',
        border: 'border-guard-red',
        bg: 'bg-guard-red/10',
      }
  }
}
