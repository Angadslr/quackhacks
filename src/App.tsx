import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonDetection } from './types/detection'
import { Controls } from './components/Controls'
import { DevTools } from './components/DevTools'
import { DrowningAlertOverlay } from './components/DrowningAlertOverlay'
import { LiveTimelineLog } from './components/LiveTimelineLog'
import { StatusBar } from './components/StatusBar'
import { VideoFeed } from './components/VideoFeed'
import { usePersonDetection } from './hooks/usePersonDetection'
import { useRiskScoring } from './hooks/useRiskScoring'
import { useTimelineLog } from './hooks/useTimelineLog'
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
  const { events, append, clear, maybeLogRiskSpike } = useTimelineLog()
  const wasAlertingRef = useRef(false)
  const wasMonitoringRef = useRef(false)

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
    activePeople,
    riskState,
    isAlerting,
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
    clear()
    append(
      mode === 'webcam' ? 'Input: webcam selected' : 'Input: video file selected',
      'system',
    )
  }, [resetSession, clear, append])

  const handleVideoFileChange = useCallback((file: File | null) => {
    setIsMonitoring(false)
    setVideoFile(file)
    setDetections([])
    resetSession()
    if (file) {
      append(`Video loaded: ${file.name}`, 'system')
    }
  }, [resetSession, append])

  useEffect(() => {
    if (isAlerting && !alertTime) {
      setAlertTime(new Date())
    }
    if (!isAlerting) {
      setAlertTime(null)
    }
  }, [isAlerting, alertTime])

  useEffect(() => {
    if (isAlerting && !wasAlertingRef.current) {
      append('Drowning alert triggered — check pool immediately', 'alert', 100)
    }
    wasAlertingRef.current = isAlerting
  }, [isAlerting, append])

  useEffect(() => {
    if (isMonitoring && !wasMonitoringRef.current) {
      append('Monitoring started', 'system')
    } else if (!isMonitoring && wasMonitoringRef.current) {
      append('Monitoring stopped', 'system')
    }
    wasMonitoringRef.current = isMonitoring
  }, [isMonitoring, append])

  useEffect(() => {
    if (!isMonitoring || activePeople.length === 0) return
    const top = activePeople[0]
    if (top) {
      maybeLogRiskSpike(top.riskScore, `Person #${top.id}`)
    }
  }, [isMonitoring, activePeople, maybeLogRiskSpike])

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
    <div className="app-shell flex min-h-screen flex-col px-3 py-3 sm:px-4 sm:py-4">
      {isAlerting && (
        <DrowningAlertOverlay
          alertTime={alertTime}
          onDismiss={resetAlert}
        />
      )}

      <div className="controls-bar flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <StatusBar
          isMonitoring={isMonitoring}
          fps={fps}
          isLoading={isLoading}
          personCount={personCount}
          sourceMode={sourceMode}
          fileName={fileName}
          isAlerting={isAlerting}
          riskState={riskState}
        />
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
        />
      </div>

      {error && (
        <div className="mt-2 rounded-lg border-2 border-guard-red bg-guard-red/20 px-3 py-2 text-sm text-guard-cream">
          {error}
        </div>
      )}

      <main className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px]">
        <VideoFeed
          videoRef={videoRef}
          activePeople={activePeople}
          rosterCount={activePeople.length}
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

        <LiveTimelineLog events={events} />
      </main>

      <p className="mt-2 text-center text-[10px] text-guard-cream/35 sm:text-xs">
        Space to start/stop · Video file mode for pool footage tests
      </p>

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
