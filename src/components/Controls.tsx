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
  onResetIncident: () => void
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
  onResetIncident,
}: ControlsProps) {
  const canStart =
    sourceMode === 'webcam' || (sourceMode === 'file' && videoFile !== null)

  const startLabel =
    sourceMode === 'file' ? 'Run Video Analysis' : 'Start Monitoring'

  const tabActive = 'bg-guard-red text-white shadow-md shadow-guard-red/30'
  const tabIdle =
    'border border-guard-maroon-light text-guard-cream/90 hover:bg-guard-maroon-mid'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSourceModeChange('webcam')}
          disabled={isMonitoring}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            sourceMode === 'webcam' ? tabActive : tabIdle
          }`}
        >
          Webcam
        </button>
        <button
          type="button"
          onClick={() => onSourceModeChange('file')}
          disabled={isMonitoring}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            sourceMode === 'file' ? tabActive : tabIdle
          }`}
        >
          Video File
        </button>
      </div>

      {sourceMode === 'file' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-guard-maroon-light px-4 py-2 text-sm text-guard-cream transition hover:border-guard-yellow/50 hover:bg-guard-maroon-mid">
            Choose video…
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
            <span className="max-w-xs truncate text-sm text-guard-pool">{fileName}</span>
          )}
          {!fileName && (
            <span className="text-sm text-guard-cream/50">MP4, WebM, MOV supported</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!isMonitoring ? (
          <button
            type="button"
            onClick={onStart}
            disabled={isLoading || !canStart}
            className="guard-btn-primary px-5 py-2.5"
          >
            {isLoading
              ? 'Loading model…'
              : sourceMode === 'file' && !isReady && videoFile
                ? 'Loading video…'
                : startLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg border-2 border-guard-yellow bg-guard-yellow/20 px-5 py-2.5 font-medium text-guard-yellow transition hover:bg-guard-yellow/30"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={onResetIncident}
          className="rounded-lg border border-guard-maroon-light px-5 py-2.5 font-medium text-guard-cream/80 transition hover:border-guard-red/50 hover:text-guard-white"
        >
          Reset Incident
        </button>
      </div>
    </div>
  )
}
