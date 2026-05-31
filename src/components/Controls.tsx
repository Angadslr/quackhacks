import type { VideoSourceMode } from '../types/videoSource'

interface ControlsProps {
  sourceMode: VideoSourceMode
  onSourceModeChange: (mode: VideoSourceMode) => void
  videoFile: File | null
  onVideoFileChange: (file: File | null) => void
  loopVideo: boolean
  onLoopVideoChange: (loop: boolean) => void
  fileName: string | null
  isMonitoring: boolean
  isLoading: boolean
  isReady: boolean
  onStart: () => void
  onStop: () => void
  onResetIncident: () => void
  isDemoMode: boolean
  onDemoModeChange: (val: boolean) => void
}

export function Controls({
  sourceMode,
  onSourceModeChange,
  videoFile,
  onVideoFileChange,
  loopVideo,
  onLoopVideoChange,
  fileName,
  isMonitoring,
  isLoading,
  isReady,
  onStart,
  onStop,
  onResetIncident,
  isDemoMode,
  onDemoModeChange,
}: ControlsProps) {
  const canStart =
    sourceMode === 'webcam' || (sourceMode === 'file' && videoFile !== null)

  const startLabel =
    sourceMode === 'file' ? 'Run Video Analysis' : 'Start Monitoring'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSourceModeChange('webcam')}
          disabled={isMonitoring}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            sourceMode === 'webcam'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-600 text-slate-300 hover:bg-slate-800'
          } disabled:opacity-50`}
        >
          Webcam
        </button>
        <button
          type="button"
          onClick={() => onSourceModeChange('file')}
          disabled={isMonitoring}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            sourceMode === 'file'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-600 text-slate-300 hover:bg-slate-800'
          } disabled:opacity-50`}
        >
          Video File
        </button>
      </div>

      {sourceMode === 'file' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
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
            <span className="max-w-xs truncate text-sm text-slate-400">
              {fileName}
            </span>
          )}
          {!fileName && (
            <span className="text-sm text-slate-500">
              MP4, WebM, MOV supported
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={loopVideo}
              disabled={isMonitoring}
              onChange={(e) => onLoopVideoChange(e.target.checked)}
              className="rounded border-slate-600"
            />
            Loop video
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!isMonitoring ? (
          <button
            type="button"
            onClick={onStart}
            disabled={isLoading || !canStart}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? 'Loading pose model…'
              : sourceMode === 'file' && !isReady && videoFile
                ? 'Loading video…'
                : startLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-slate-700 px-5 py-2.5 font-medium text-white transition hover:bg-slate-600"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={onResetIncident}
          className="rounded-lg border border-slate-600 px-5 py-2.5 font-medium text-slate-300 transition hover:bg-slate-800"
        >
          Reset Incident
        </button>
        <button
          type="button"
          onClick={() => onDemoModeChange(!isDemoMode)}
          className={`rounded-lg border px-5 py-2.5 font-medium transition ${
            isDemoMode
              ? 'border-violet-500 bg-violet-500/10 text-violet-400'
              : 'border-slate-600 text-slate-400 hover:bg-slate-800'
          }`}
        >
          {isDemoMode ? 'Demo Mode ON' : 'Demo Mode'}
        </button>
      </div>
    </div>
  )
}
