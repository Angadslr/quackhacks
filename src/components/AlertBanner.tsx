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
      className="animate-pulse rounded-lg border-2 border-red-600 bg-red-950 px-4 py-3 text-center"
    >
      <p className="text-lg font-bold text-red-400">
        ALERT: {riskState} DETECTED — Check pool immediately!
      </p>
      {timeStr && (
        <p className="mt-1 text-sm text-red-300">Triggered at {timeStr}</p>
      )}
    </div>
  )
}
