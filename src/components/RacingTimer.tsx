const AI_TARGET_MS = 4000
const LIFEGUARD_TARGET_MS = 24000

interface RacingTimerProps {
  watchDurationMs: number
  isAlerting: boolean
  isActive: boolean
}

export function RacingTimer({ watchDurationMs, isAlerting, isActive }: RacingTimerProps) {
  if (!isActive) return null

  const aiProgress = Math.min(1, watchDurationMs / AI_TARGET_MS)
  const lgProgress = Math.min(1, watchDurationMs / LIFEGUARD_TARGET_MS)
  const aiSecs = (Math.min(watchDurationMs, AI_TARGET_MS) / 1000).toFixed(1)
  const lgSecs = (Math.min(watchDurationMs, LIFEGUARD_TARGET_MS) / 1000).toFixed(1)
  const savedSecs = Math.max(0, (LIFEGUARD_TARGET_MS - watchDurationMs) / 1000)

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Response Time Race
      </p>

      {/* AI System row */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`text-sm font-semibold ${isAlerting ? 'text-emerald-400' : 'text-white'}`}>
            AI System
          </span>
          <span className={`font-mono text-sm ${isAlerting ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
            {isAlerting ? `✓ ALERTED at ${aiSecs}s` : `${aiSecs}s / 4s`}
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAlerting ? 'bg-emerald-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${aiProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Lifeguard row */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-400">Avg Lifeguard</span>
          <span className="font-mono text-sm text-slate-500">
            {lgSecs}s / 24s
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-orange-700 transition-all duration-300"
            style={{ width: `${lgProgress * 100}%` }}
          />
        </div>
      </div>

      {isAlerting && (
        <div className="mt-3 rounded border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-center">
          <p className="text-sm font-bold text-emerald-400">
            {savedSecs.toFixed(0)}s ahead of average lifeguard response
          </p>
        </div>
      )}

      {!isAlerting && (
        <p className="mt-1 text-center text-xs text-slate-600">
          System alerts at 4s · Avg lifeguard notices at 24s
        </p>
      )}
    </div>
  )
}
