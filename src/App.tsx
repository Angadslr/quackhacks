import { useCallback, useEffect, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { AlertBanner } from './components/AlertBanner'
import { ContributorsPanel } from './components/ContributorsPanel'
import { Controls } from './components/Controls'
import { ReplayViewer } from './components/ReplayViewer'
import { RiskMeter } from './components/RiskMeter'
import { StatusBar } from './components/StatusBar'
import { VideoFeed } from './components/VideoFeed'
import { usePoseDetection } from './hooks/usePoseDetection'
import { useRiskScoring } from './hooks/useRiskScoring'
import { useVideoSource } from './hooks/useVideoSource'
import type { VideoSourceMode } from './types/videoSource'

function App() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [poses, setPoses] = useState<NormalizedLandmark[][]>([])
  const [alertTime, setAlertTime] = useState<Date | null>(null)
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('webcam')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [loopVideo, setLoopVideo] = useState(true)

  const {
    videoRef,
    error: videoError,
    isReady,
    mirrored,
    fileName,
    videoDuration,
    videoCurrentTime,
  } = useVideoSource({
    mode: sourceMode,
    videoFile,
    isMonitoring,
    loop: loopVideo,
  })

  const onPoses = useCallback((next: NormalizedLandmark[][]) => {
    setPoses(next)
  }, [])

  const onPosesWithTimestamp = useCallback(
    (next: NormalizedLandmark[][], _timestamp: number) => {
      onPoses(next)
    },
    [onPoses],
  )

  const { fps, isLoading, error: poseError, poseCount } = usePoseDetection({
    isMonitoring,
    isReady,
    videoRef,
    useVideoTimestamp: sourceMode === 'file',
    onPoses: onPosesWithTimestamp,
  })

  const {
    people,
    riskScore,
    riskState,
    contributors,
    highestRiskPersonId,
    isAlerting,
    highRiskDurationMs,
    incidents,
    resetAlert,
  } = useRiskScoring(poses, isMonitoring)

  const handleSourceModeChange = useCallback((mode: VideoSourceMode) => {
    setIsMonitoring(false)
    setSourceMode(mode)
    if (mode === 'webcam') {
      setVideoFile(null)
    }
    setPoses([])
    resetAlert()
  }, [resetAlert])

  const handleVideoFileChange = useCallback((file: File | null) => {
    setIsMonitoring(false)
    setVideoFile(file)
    setPoses([])
    resetAlert()
  }, [resetAlert])

  useEffect(() => {
    if (isAlerting && !alertTime) {
      setAlertTime(new Date())
    }
    if (!isAlerting) {
      setAlertTime(null)
    }
  }, [isAlerting, alertTime])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target !== document.body) return
      e.preventDefault()
      if (sourceMode === 'file' && !videoFile) return
      setIsMonitoring((prev) => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sourceMode, videoFile])

  const error = videoError ?? poseError

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <StatusBar
        isMonitoring={isMonitoring}
        fps={fps}
        isLoading={isLoading}
        poseCount={poseCount}
        sourceMode={sourceMode}
        fileName={fileName}
      />

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">Input source</p>
        <Controls
          sourceMode={sourceMode}
          onSourceModeChange={handleSourceModeChange}
          videoFile={videoFile}
          onVideoFileChange={handleVideoFileChange}
          loopVideo={loopVideo}
          onLoopVideoChange={setLoopVideo}
          fileName={fileName}
          isMonitoring={isMonitoring}
          isLoading={isLoading}
          isReady={isReady}
          onStart={() => setIsMonitoring(true)}
          onStop={() => setIsMonitoring(false)}
          onResetIncident={resetAlert}
        />
        <p className="mt-2 text-xs text-slate-600">
          Press Space to start/stop · Switch to <strong className="text-slate-400">Video File</strong> to test pool footage
        </p>
      </div>

      <main className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <VideoFeed
          videoRef={videoRef}
          people={people}
          isMonitoring={isMonitoring}
          mirrored={mirrored}
          sourceMode={sourceMode}
          isReady={isReady}
          fileName={fileName}
          videoDuration={videoDuration}
          videoCurrentTime={videoCurrentTime}
        />

        <aside className="flex flex-col gap-4">
          <RiskMeter score={riskScore} state={riskState} />
          <ContributorsPanel
            contributors={contributors}
            score={riskScore}
            personId={highestRiskPersonId}
            peopleCount={people.length}
          />
          {people.length > 1 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <p className="mb-2 text-xs font-medium text-slate-400">
                Per-person risk
              </p>
              <ul className="space-y-1">
                {people.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between text-sm text-slate-300"
                  >
                    <span>Person #{p.id}</span>
                    <span className="font-mono">{Math.round(p.riskScore)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isMonitoring && riskScore > 65 && !isAlerting && (
            <p className="text-xs text-slate-500">
              High risk for {(highRiskDurationMs / 1000).toFixed(1)}s — alert at
              4s
            </p>
          )}
        </aside>
      </main>

      <div className="mt-4">
        <AlertBanner
          isAlerting={isAlerting}
          riskState={riskState}
          alertTime={alertTime}
        />
      </div>

      <div className="mt-6">
        <ReplayViewer incidents={incidents} />
      </div>
    </div>
  )
}

export default App
