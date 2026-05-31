export type RiskState = 'SAFE' | 'WATCH' | 'WARNING' | 'ALERT'

export interface SignalBreakdown {
  vertical: number
  arms: number
  submersion: number
  stasis: number
}

export interface RiskResult {
  score: number
  state: RiskState
  contributors: SignalBreakdown
}

export interface PoseHistoryEntry {
  timestamp: number
  landmarks: import('./pose').NormalizedLandmark[]
}

export function getRiskState(score: number): RiskState {
  if (score >= 65) return 'ALERT'
  if (score >= 55) return 'WARNING'
  if (score >= 40) return 'WATCH'
  return 'SAFE'
}

export function getSkeletonColor(state: RiskState): string {
  switch (state) {
    case 'SAFE':    return '#34d399'
    case 'WATCH':   return '#facc15'
    case 'WARNING': return '#f97316'
    case 'ALERT':   return '#ef4444'
  }
}

export function getStateTailwind(state: RiskState): {
  text: string
  border: string
  bg: string
} {
  switch (state) {
    case 'SAFE':
      return { text: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-500/10' }
    case 'WATCH':
      return { text: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-500/10' }
    case 'WARNING':
      return { text: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-500/10' }
    case 'ALERT':
      return { text: 'text-red-500', border: 'border-red-600', bg: 'bg-red-500/10' }
  }
}
