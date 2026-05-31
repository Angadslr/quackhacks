import type { RiskState } from '../types/risk'

interface AlertBannerProps {
  isAlerting: boolean
  riskState: RiskState
  alertTime: Date | null
}

export function AlertBanner({ isAlerting, riskState, alertTime }: AlertBannerProps) {
  if (!isAlerting) return null

  const timeStr = alertTime
    ? alertTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <div
      role="alert"
      className="animate-pulse rounded-lg border-4 border-guard-yellow bg-guard-red px-4 py-4 text-center shadow-lg shadow-guard-red/40"
    >
      <p className="text-lg font-bold uppercase tracking-wide text-guard-white">
        Rescue alert — {riskState}
      </p>
      <p className="mt-1 text-sm font-medium text-guard-cream">
        Check the pool immediately
      </p>
      {timeStr && (
        <p className="mt-1 text-xs text-guard-yellow">Triggered at {timeStr}</p>
      )}
    </div>
  )
}
