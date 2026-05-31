import type { RiskState } from '../types/risk'
import type { VideoSourceMode } from '../types/videoSource'

interface StatusBarProps {
  isMonitoring: boolean
  fps: number
  isLoading: boolean
  personCount: number
  sourceMode: VideoSourceMode
  fileName: string | null
  isAlerting?: boolean
  riskState?: RiskState
}

export function StatusBar({
  isMonitoring,
  fps,
  isLoading,
  personCount,
  sourceMode,
  fileName,
  isAlerting = false,
  riskState = 'SAFE',
}: StatusBarProps) {
  const sourceLabel =
    sourceMode === 'file'
      ? fileName
        ? `Video: ${fileName}`
        : 'Video file'
      : 'Webcam'

  return (
    <header className="shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            <span className="text-guard-white">my</span>
            <span className="text-guard-red">guard</span>
          </h1>
          <span className="hidden rounded border border-guard-yellow/40 bg-guard-yellow/10 px-2 py-0.5 text-xs font-medium text-guard-yellow sm:inline">
            Lifeguard monitor
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          {isAlerting && (
            <span className="font-semibold text-guard-red">
              ⚠ Alert active
            </span>
          )}
          {!isAlerting && isMonitoring && (
            <span className="text-guard-cream/60">{riskState}</span>
          )}
          <span className="hidden max-w-[140px] truncate text-guard-pool/80 md:inline">
            {sourceLabel}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isMonitoring
                  ? isLoading
                    ? 'animate-pulse bg-guard-yellow'
                    : 'bg-guard-red shadow-[0_0_8px_rgba(220,38,38,0.8)]'
                  : 'bg-guard-maroon-light'
              }`}
            />
            <span className="text-guard-cream/80">
              {isLoading
                ? 'Loading model…'
                : isMonitoring
                  ? 'On duty'
                  : 'Off duty'}
            </span>
          </div>
          {isMonitoring && !isLoading && (
            <>
              <span className="font-mono text-guard-cream/70">FPS: {fps}</span>
              <span className="font-mono text-guard-cream/70">
                People: {personCount}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
