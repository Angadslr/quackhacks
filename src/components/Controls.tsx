import type { VideoSourceMode } from '../types/videoSource'

interface ControlsProps {
  sourceMode: VideoSourceMode
  onSourceModeChange: (mode: VideoSourceMode) => void
  videoFile: File | null
  onVideoFileChange: (file: File | null) => void
  fileName: string | null
  isMonitoring: boolean
  isLoading: boolean
  isReady: boolean
  onStart: () => void
  onStop: () => void
}

export function Controls({
  sourceMode,
  onSourceModeChange,
  videoFile,
  onVideoFileChange,
  fileName,
  isMonitoring,
  isLoading,
  isReady,
  onStart,
  onStop,
}: ControlsProps) {
  const canStart =
    sourceMode === 'webcam' || (sourceMode === 'file' && videoFile !== null)

  const startLabel =
    sourceMode === 'file' ? 'Run analysis' : 'Start monitoring'

  const tabActive = 'bg-guard-red text-white'
  const tabIdle =
    'border border-guard-maroon-light/80 text-guard-cream/90 hover:bg-guard-maroon-mid/80'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onSourceModeChange('webcam')}
          disabled={isMonitoring}
          className={`rounded px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 sm:text-sm ${
            sourceMode === 'webcam' ? tabActive : tabIdle
          }`}
        >
          Webcam
        </button>
        <button
          type="button"
          onClick={() => onSourceModeChange('file')}
          disabled={isMonitoring}
          className={`rounded px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 sm:text-sm ${
            sourceMode === 'file' ? tabActive : tabIdle
          }`}
        >
          Video file
        </button>
      </div>

      {sourceMode === 'file' && (
        <>
          <label className="cursor-pointer rounded border border-guard-maroon-light/80 px-2.5 py-1.5 text-xs text-guard-cream transition hover:border-guard-yellow/50 sm:text-sm">
            Choose…
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={isMonitoring}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                onVideoFileChange(file)
                e.target.value = ''
              }}
            />
          </label>
          {fileName && (
            <span className="max-w-[120px] truncate text-xs text-guard-pool sm:max-w-[180px]">
              {fileName}
            </span>
          )}
        </>
      )}

      {!isMonitoring ? (
        <button
          type="button"
          onClick={onStart}
          disabled={isLoading || !canStart}
          className="guard-btn-primary rounded px-3 py-1.5 text-xs sm:text-sm"
        >
          {isLoading
            ? 'Loading…'
            : sourceMode === 'file' && !isReady && videoFile
              ? 'Loading video…'
              : startLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStop}
          className="rounded border border-guard-yellow bg-guard-yellow/20 px-3 py-1.5 text-xs font-medium text-guard-yellow sm:text-sm"
        >
          Stop
        </button>
      )}
    </div>
  )
}
