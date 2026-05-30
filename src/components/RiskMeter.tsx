import type { RiskState } from '../types/risk'
import { getStateTailwind } from '../types/risk'

interface RiskMeterProps {
  score: number
  state: RiskState
}

export function RiskMeter({ score, state }: RiskMeterProps) {
  const colors = getStateTailwind(state)
  const barColor =
    state === 'SAFE'
      ? 'bg-emerald-500'
      : state === 'CAUTION'
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div
      className={`rounded-lg border p-6 ${colors.border} ${colors.bg}`}
    >
      <p className="mb-1 text-sm text-slate-400">Risk Score</p>
      <p className={`text-5xl font-bold tabular-nums ${colors.text}`}>
        {Math.round(score)}%
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${barColor} ${state === 'CRITICAL' ? 'animate-pulse' : ''}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={`mt-3 text-lg font-semibold ${colors.text}`}>{state}</p>
    </div>
  )
}
