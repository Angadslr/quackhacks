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
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-white">
          POOL GUARD
        </h1>
        <span className="text-xs text-slate-500">
          Client-side drowning detection
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="max-w-[200px] truncate text-slate-500">{sourceLabel}</span>
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isMonitoring
                ? isLoading
                  ? 'animate-pulse bg-yellow-400'
                  : 'bg-emerald-400'
                : 'bg-slate-600'
            }`}
          />
          <span className="text-slate-400">
            {isLoading
              ? 'Loading model…'
              : isMonitoring
                ? 'Analyzing'
                : 'Idle'}
          </span>
        </div>
        {isMonitoring && !isLoading && (
          <>
            <span className="font-mono text-slate-400">FPS: {fps}</span>
            <span className="font-mono text-slate-400">
              People: {personCount}
            </span>
          </>
        )}
      </div>
    </header>
  )
}
