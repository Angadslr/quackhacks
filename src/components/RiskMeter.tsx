import type { RiskState } from '../types/risk'
import { getStateTailwind } from '../types/risk'

interface RiskMeterProps {
  score: number
  state: RiskState
}

const STATE_LABELS: Record<RiskState, string> = {
  SAFE: 'SAFE',
  WATCH: 'WATCH',
  WARNING: 'WARNING',
  ALERT: 'ALERT',
}

const BAR_COLOR: Record<RiskState, string> = {
  SAFE: 'bg-emerald-500',
  WATCH: 'bg-yellow-500',
  WARNING: 'bg-orange-500',
  ALERT: 'bg-red-500',
}

export function RiskMeter({ score, state }: RiskMeterProps) {
  const colors = getStateTailwind(state)

  return (
    <div className={`rounded-lg border p-6 ${colors.border} ${colors.bg}`}>
      <p className="mb-1 text-sm text-slate-400">Risk Score</p>
      <p className={`text-5xl font-bold tabular-nums ${colors.text}`}>
        {Math.round(score)}%
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${BAR_COLOR[state]} ${state === 'ALERT' ? 'animate-pulse' : ''}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className={`text-lg font-semibold ${colors.text}`}>{STATE_LABELS[state]}</p>
        {state !== 'SAFE' && (
          <div className="flex gap-1">
            {(['WATCH', 'WARNING', 'ALERT'] as RiskState[]).map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full ${
                  s === 'WATCH' ? 'bg-yellow-500' : s === 'WARNING' ? 'bg-orange-500' : 'bg-red-500'
                } ${score >= (s === 'WATCH' ? 40 : s === 'WARNING' ? 55 : 65) ? 'opacity-100' : 'opacity-20'}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-600">
        <span>40 WATCH</span>
        <span>55 WARNING</span>
        <span>65 ALERT</span>
      </div>
    </div>
  )
}
