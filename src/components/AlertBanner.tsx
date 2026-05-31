import type { RiskState } from '../types/risk'

interface AlertBannerProps {
  isAlerting: boolean
  riskState: RiskState
  alertTime: Date | null
  highRiskDurationMs: number
}

export function AlertBanner({ isAlerting, riskState, alertTime, highRiskDurationMs }: AlertBannerProps) {
  if (riskState === 'SAFE') return null

  if (!isAlerting) {
    if (riskState === 'WATCH') {
      return (
        <div className="rounded-lg border border-yellow-700 bg-yellow-950/40 px-4 py-2 text-center">
          <p className="text-sm font-medium text-yellow-400">
            WATCH — Elevated risk pattern detected. Monitoring…
          </p>
        </div>
      )
    }
    if (riskState === 'WARNING') {
      return (
        <div className="rounded-lg border border-orange-600 bg-orange-950/40 px-4 py-3 text-center">
          <p className="font-semibold text-orange-400">
            WARNING — Distress pattern detected
          </p>
          <p className="mt-0.5 text-xs text-orange-300">
            Alert fires in {Math.max(0, ((4000 - highRiskDurationMs) / 1000)).toFixed(1)}s if pattern continues
          </p>
        </div>
      )
    }
    return null
  }

  const timeStr = alertTime
    ? alertTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <div
      role="alert"
      className="animate-pulse rounded-lg border-2 border-red-600 bg-red-950 px-4 py-4 text-center"
    >
      <p className="text-xl font-bold text-red-400">
        ALERT — Possible drowning emergency!
      </p>
      <p className="mt-1 text-sm text-red-300">
        Check pool immediately · Contact emergency services if unresponsive
      </p>
      {timeStr && (
        <p className="mt-1 text-xs text-red-400/70">Triggered at {timeStr}</p>
      )}
    </div>
  )
}
