import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonDetection } from './types/detection'
import type { Incident } from './types/pose'
import { Controls } from './components/Controls'
import { DevTools } from './components/DevTools'
import { DrowningAlertOverlay } from './components/DrowningAlertOverlay'
import { LiveTimelineLog } from './components/LiveTimelineLog'
import { ReplayViewer } from './components/ReplayViewer'
import { StatusBar } from './components/StatusBar'
import { VideoFeed } from './components/VideoFeed'
import {
  useIncidentBriefing,
  type IncidentBriefingContext,
  type IncidentBriefingRequestPayload,
} from './hooks/useIncidentBriefing'
import { usePersonDetection } from './hooks/usePersonDetection'
import { useRiskScoring } from './hooks/useRiskScoring'
import { useTimelineLog } from './hooks/useTimelineLog'
import { useVideoSource } from './hooks/useVideoSource'
import { useZones } from './hooks/useZones'
import type { VideoSourceMode } from './types/videoSource'
import type { ZoneKind } from './types/zone'
import { serializeIncident } from './utils/serializeIncident'

interface LatchedAlert {
  alertTime: Date
  briefing: string | null
  incidentSummary: string | null
  briefingLoading: boolean
  briefingError: string | null
}

function App() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [detections, setDetections] = useState<PersonDetection[]>([])
  const [latchedAlert, setLatchedAlert] = useState<LatchedAlert | null>(null)
  const [persistedIncidents, setPersistedIncidents] = useState<Incident[]>([])
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('webcam')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [incidentSummaries, setIncidentSummaries] = useState<
    Record<string, string>
  >({})
  const { zones, addZone, removeZone, clearZones } = useZones()
  const [zoneEditing, setZoneEditing] = useState(false)
  const [zoneDrawKind, setZoneDrawKind] = useState<ZoneKind>('monitor')
  const { events, append, clear, maybeLogRiskSpike } = useTimelineLog()
  const wasAlertingRef = useRef(false)
  const wasMonitoringRef = useRef(false)
  const alertIncidentIdRef = useRef<string | null>(null)
  const persistedIncidentIdsRef = useRef<string[]>([])
  const [briefingRequest, setBriefingRequest] =
    useState<IncidentBriefingRequestPayload | null>(null)

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
    riskScore,
    riskState,
    contributors,
    highestRiskPersonId,
    highRiskDurationMs,
    incidents,
    isAlerting,
    resetAlert,
    resetSession,
  } = useRiskScoring(detections, isMonitoring, zones)

  const handleBriefingReady = useCallback(
    (result: { briefing: string; incidentSummary: string }) => {
      append(result.briefing, 'ai', Math.round(riskScore))
      setIncidentSummaries((prev) => {
        const next = { ...prev }
        for (const id of persistedIncidentIdsRef.current) {
          next[id] = result.incidentSummary
        }
        const alertId = alertIncidentIdRef.current
        if (alertId) {
          next[alertId] = result.incidentSummary
        }
        return next
      })
    },
    [append, riskScore],
  )

  const {
    briefing,
    incidentSummary,
    loading: briefingLoading,
    error: briefingError,
    reset: resetBriefing,
  } = useIncidentBriefing({
    request: briefingRequest,
    onReady: handleBriefingReady,
  })

  const clearPersistedAlert = useCallback(() => {
    setLatchedAlert(null)
    setPersistedIncidents([])
    setBriefingRequest(null)
    persistedIncidentIdsRef.current = []
    setIncidentSummaries({})
    resetBriefing()
    resetAlert()
  }, [resetAlert, resetBriefing])

  const handleDismissAlert = useCallback(() => {
    clearPersistedAlert()
  }, [clearPersistedAlert])

  const handleStartMonitoring = useCallback(() => {
    clearPersistedAlert()
    setIsMonitoring(true)
  }, [clearPersistedAlert])

  const handleSourceModeChange = useCallback((mode: VideoSourceMode) => {
    setIsMonitoring(false)
    setSourceMode(mode)
    if (mode === 'webcam') {
      setVideoFile(null)
    }
    setDetections([])
    resetSession()
    clearPersistedAlert()
    clear()
    append(
      mode === 'webcam' ? 'Input: webcam selected' : 'Input: video file selected',
      'system',
    )
  }, [resetSession, clearPersistedAlert, clear, append])

  const handleVideoFileChange = useCallback((file: File | null) => {
    setIsMonitoring(false)
    setVideoFile(file)
    setDetections([])
    resetSession()
    clearPersistedAlert()
    if (file) {
      append(`Video loaded: ${file.name}`, 'system')
    }
  }, [resetSession, clearPersistedAlert, append])

  useEffect(() => {
    setLatchedAlert((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        briefing: briefing ?? prev.briefing,
        incidentSummary: incidentSummary ?? prev.incidentSummary,
        briefingLoading,
        briefingError,
      }
    })
  }, [briefing, incidentSummary, briefingLoading, briefingError])

  useEffect(() => {
    if (isAlerting && !wasAlertingRef.current) {
      const latest = incidents[0] ?? null
      const snapIncidents = [...incidents]
      const incidentId = latest?.id ?? `alert-${Date.now()}`

      alertIncidentIdRef.current = latest?.id ?? null
      persistedIncidentIdsRef.current = snapIncidents.map((i) => i.id)
      setPersistedIncidents(snapIncidents)

      const context: IncidentBriefingContext = {
        riskScore,
        riskState,
        contributors,
        personId: highestRiskPersonId,
        highRiskDurationMs,
        timeline: events.slice(0, 15).map((e) => ({
          message: e.message,
          kind: e.kind,
          time: e.time.toISOString(),
        })),
        incident: latest ? serializeIncident(latest) : null,
      }

      setBriefingRequest({ id: incidentId, context })
      setLatchedAlert({
        alertTime: new Date(),
        briefing: null,
        incidentSummary: null,
        briefingLoading: true,
        briefingError: null,
      })
      append('Drowning alert triggered — check pool immediately', 'alert', 100)
      append('Requesting Gemini incident analysis…', 'info')
    }
    wasAlertingRef.current = isAlerting
  }, [
    isAlerting,
    append,
    incidents,
    riskScore,
    riskState,
    contributors,
    highestRiskPersonId,
    highRiskDurationMs,
    events,
  ])

  useEffect(() => {
    if (isMonitoring && !wasMonitoringRef.current) {
      append('Monitoring started', 'system')
    } else if (!isMonitoring && wasMonitoringRef.current) {
      append('Monitoring stopped', 'system')
      if (isAlerting) {
        resetAlert()
      }
    }
    wasMonitoringRef.current = isMonitoring
  }, [isMonitoring, isAlerting, resetAlert, append])

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
      setIsMonitoring((prev) => {
        if (!prev) {
          clearPersistedAlert()
        }
        return !prev
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sourceMode, videoFile, clearPersistedAlert])

  const displayIncidents =
    persistedIncidents.length > 0 ? persistedIncidents : incidents

  const error = videoError ?? detectionError

  return (
    <div className="app-shell flex min-h-screen flex-col px-3 py-3 sm:px-4 sm:py-4">
      {latchedAlert && (
        <DrowningAlertOverlay
          alertTime={latchedAlert.alertTime}
          onDismiss={handleDismissAlert}
        />
      )}

      <div className="controls-bar flex flex-nowrap items-center justify-between gap-2 px-3 py-2">
        <StatusBar
          isMonitoring={isMonitoring}
          fps={fps}
          isLoading={isLoading}
          personCount={personCount}
          sourceMode={sourceMode}
          fileName={fileName}
          isAlerting={isAlerting || latchedAlert !== null}
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
          onStart={handleStartMonitoring}
          onStop={() => setIsMonitoring(false)}
        />
      </div>

      {error && (
        <div className="mt-2 rounded-lg border-2 border-guard-red bg-guard-red/20 px-3 py-2 text-sm text-guard-cream">
          {error}
        </div>
      )}

      <main className="mx-auto mt-3 grid min-h-0 w-[80%] max-w-[1020px] flex-1 gap-3 lg:grid-cols-[minmax(0,768px)_224px] xl:grid-cols-[minmax(0,768px)_240px]">
        <div className="mx-auto w-full max-w-[768px]">
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
        </div>

        <LiveTimelineLog events={events} />
      </main>

      {displayIncidents.length > 0 && (
        <div className="mx-auto mt-4 w-[80%] max-w-[1020px]">
          <ReplayViewer
            incidents={displayIncidents}
            summariesByIncidentId={incidentSummaries}
            fallbackBriefing={latchedAlert?.briefing}
            fallbackSummary={latchedAlert?.incidentSummary}
            summaryLoading={latchedAlert?.briefingLoading ?? false}
            summaryError={latchedAlert?.briefingError}
          />
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-guard-cream/35 sm:text-xs">
        Space to start/stop · Video file mode for pool footage tests · Gemini API
        for incident briefings
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
