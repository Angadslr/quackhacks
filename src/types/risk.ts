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
      return '#34d399'
    case 'CAUTION':
      return '#facc15'
    case 'DISTRESS':
    case 'CRITICAL':
      return '#ef4444'
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
        text: 'text-emerald-400',
        border: 'border-emerald-500',
        bg: 'bg-emerald-500/10',
      }
    case 'CAUTION':
      return {
        text: 'text-yellow-400',
        border: 'border-yellow-500',
        bg: 'bg-yellow-500/10',
      }
    case 'DISTRESS':
      return {
        text: 'text-red-500',
        border: 'border-red-600',
        bg: 'bg-red-500/10',
      }
    case 'CRITICAL':
      return {
        text: 'text-red-500',
        border: 'border-red-600',
        bg: 'bg-red-500/10',
      }
  }
}
