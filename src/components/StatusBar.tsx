import type { VideoSourceMode } from '../types/videoSource'

interface StatusBarProps {
  isMonitoring: boolean
  fps: number
  isLoading: boolean
  personCount: number
  sourceMode: VideoSourceMode
  fileName: string | null
}

export function StatusBar({
  isMonitoring,
  fps,
  isLoading,
  personCount,
  sourceMode,
  fileName,
}: StatusBarProps) {
  const sourceLabel =
    sourceMode === 'file'
      ? fileName
        ? `Video: ${fileName}`
        : 'Video file'
      : 'Webcam'

  return (
    <header className="border-b-2 border-guard-red pb-4">
      <div className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-guard-red via-guard-yellow to-guard-red" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-guard-red">My</span>
            <span className="text-guard-white">Guard</span>
          </h1>
          <span className="rounded border border-guard-yellow/40 bg-guard-yellow/10 px-2 py-0.5 text-xs font-medium text-guard-yellow">
            Lifeguard monitor
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="max-w-[200px] truncate text-guard-pool/80">{sourceLabel}</span>
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
