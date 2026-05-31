import { useCallback, useEffect, useState } from 'react'
import type { PersonDetection } from './types/detection'
import { AlertBanner } from './components/AlertBanner'
import { Controls } from './components/Controls'
import { DevTools } from './components/DevTools'
import { PeopleList } from './components/PeopleList'
import { ReplayViewer } from './components/ReplayViewer'
import { StatusBar } from './components/StatusBar'
import { VideoFeed } from './components/VideoFeed'
import { usePersonDetection } from './hooks/usePersonDetection'
import { useRiskScoring } from './hooks/useRiskScoring'
import { useVideoSource } from './hooks/useVideoSource'
import { useZones } from './hooks/useZones'
import type { VideoSourceMode } from './types/videoSource'
import type { ZoneKind } from './types/zone'

function App() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [detections, setDetections] = useState<PersonDetection[]>([])
  const [alertTime, setAlertTime] = useState<Date | null>(null)
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('webcam')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const { zones, addZone, removeZone, clearZones } = useZones()
  const [zoneEditing, setZoneEditing] = useState(false)
  const [zoneDrawKind, setZoneDrawKind] = useState<ZoneKind>('monitor')

  const handleVideoEnded = useCallback(() => {
    setIsMonitoring(false)
  }, [])

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
    onVideoEnded: handleVideoEnded,
  })

  const onDetections = useCallback((next: PersonDetection[]) => {
    setDetections(next)
  }, [])

  const onDetectionsWithTimestamp = useCallback(
    (next: PersonDetection[], _timestamp: number) => {
      onDetections(next)
    },
    [onDetections],
  )

  const { fps, isLoading, error: detectionError, personCount } = usePersonDetection({
    isMonitoring,
    isReady,
    videoRef,
    useVideoTimestamp: sourceMode === 'file',
    onDetections: onDetectionsWithTimestamp,
  })

  const {
    people,
    activePeople,
    riskState,
    isAlerting,
    incidents,
    resetAlert,
    resetSession,
  } = useRiskScoring(detections, isMonitoring, zones)

  const handleSourceModeChange = useCallback((mode: VideoSourceMode) => {
    setIsMonitoring(false)
    setSourceMode(mode)
    if (mode === 'webcam') {
      setVideoFile(null)
    }
    setDetections([])
    resetSession()
  }, [resetSession])

  const handleVideoFileChange = useCallback((file: File | null) => {
    setIsMonitoring(false)
    setVideoFile(file)
    setDetections([])
    resetSession()
  }, [resetSession])

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

  const error = videoError ?? detectionError

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <StatusBar
        isMonitoring={isMonitoring}
        fps={fps}
        isLoading={isLoading}
        personCount={personCount}
        sourceMode={sourceMode}
        fileName={fileName}
      />

      {error && (
        <div className="mt-4 rounded-lg border-2 border-guard-red bg-guard-red/20 px-4 py-3 text-guard-cream">
          {error}
        </div>
      )}

      <div className="guard-panel mt-4 p-4">
        <p className="mb-3 text-sm font-medium text-guard-yellow">Input source</p>
        <Controls
          sourceMode={sourceMode}
          onSourceModeChange={handleSourceModeChange}
          videoFile={videoFile}
          onVideoFileChange={handleVideoFileChange}
          fileName={fileName}
          isMonitoring={isMonitoring}
          isLoading={isLoading}
          isReady={isReady}
          onStart={() => setIsMonitoring(true)}
          onStop={() => setIsMonitoring(false)}
          onResetIncident={resetAlert}
        />
        <p className="mt-2 text-xs text-guard-cream/40">
          Press Space to start/stop · Switch to <strong className="text-guard-pool">Video File</strong> to test pool footage
        </p>
      </div>

      <main className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <VideoFeed
          videoRef={videoRef}
          activePeople={activePeople}
          rosterCount={people.length}
          isMonitoring={isMonitoring}
          mirrored={mirrored}
          sourceMode={sourceMode}
          isReady={isReady}
          fileName={fileName}
          videoDuration={videoDuration}
          videoCurrentTime={videoCurrentTime}
          zones={zones}
          zoneEditing={zoneEditing}
          zoneDrawKind={zoneDrawKind}
          onZoneCreate={addZone}
          onZoneRemove={removeZone}
        />

        <aside className="flex flex-col gap-4">
          <PeopleList people={people} />
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

      <DevTools
        zones={zones}
        editing={zoneEditing}
        drawKind={zoneDrawKind}
        onToggleEditing={() => setZoneEditing((prev) => !prev)}
        onDrawKindChange={setZoneDrawKind}
        onClear={clearZones}
      />
    </div>
  )
}

export default App
