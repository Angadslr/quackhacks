import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonDetection } from '../types/detection'
import type { TrackedPerson } from '../types/person'
import type { Incident } from '../types/pose'
import type { DetectionHistoryEntry, RiskResult, RiskState } from '../types/risk'
import { AlertSound } from '../utils/alertSound'
import { DetectionTracker } from '../utils/detectionTracker'
import { computeRisk } from '../utils/riskEngine'
import { ReplayRecorder } from '../utils/replayRecorder'
import type { Zone } from '../types/zone'

const ALERT_THRESHOLD = 65
const ALERT_DURATION_MS = 4000
const HISTORY_DURATION_MS = 5000

interface UseRiskScoringResult {
  people: TrackedPerson[]
  riskScore: number
  riskState: RiskState
  contributors: RiskResult['contributors']
  highestRiskPersonId: number | null
  isAlerting: boolean
  highRiskDurationMs: number
  incidents: Incident[]
  resetAlert: () => void
}

export function useRiskScoring(
  detections: PersonDetection[],
  isMonitoring: boolean,
  zones: Zone[] = [],
): UseRiskScoringResult {
  const recorderRef = useRef(new ReplayRecorder())
  const alertSoundRef = useRef(new AlertSound())
  const trackerRef = useRef(new DetectionTracker())
  const historyMapRef = useRef<Map<number, DetectionHistoryEntry[]>>(new Map())
  const hasTriggeredAlertRef = useRef(false)
  const peakAtAlertRef = useRef<{ person: TrackedPerson } | null>(null)

  const [people, setPeople] = useState<TrackedPerson[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [riskState, setRiskState] = useState<RiskState>('SAFE')
  const [contributors, setContributors] = useState<RiskResult['contributors']>({
    submersion: 0,
    stasis: 0,
    disappearance: 0,
    distress: 0,
  })
  const [highestRiskPersonId, setHighestRiskPersonId] = useState<number | null>(
    null,
  )
  const [isAlerting, setIsAlerting] = useState(false)
  const [highRiskDurationMs, setHighRiskDurationMs] = useState(0)
  const [incidents, setIncidents] = useState<Incident[]>([])

  const resetAlert = useCallback(() => {
    hasTriggeredAlertRef.current = false
    peakAtAlertRef.current = null
    recorderRef.current.resetHighRiskTracking()
    setIsAlerting(false)
    alertSoundRef.current.stop()
  }, [])

  useEffect(() => {
    if (!isMonitoring) {
      resetAlert()
      trackerRef.current.reset()
      historyMapRef.current.clear()
      setPeople([])
      setRiskScore(0)
      setRiskState('SAFE')
      setContributors({ submersion: 0, stasis: 0, disappearance: 0, distress: 0 })
      setHighestRiskPersonId(null)
      setHighRiskDurationMs(0)
      return
    }

    const now = performance.now()
    const trackedRaw = trackerRef.current.assignAndTrack(detections, now, zones)
    const tracked: TrackedPerson[] = []

    for (const item of trackedRaw) {
      const history = historyMapRef.current.get(item.id) ?? []
      const result = computeRisk(
        {
          bbox: item.bbox,
          confidence: item.confidence,
          center: item.center,
          isMissing: item.isMissing,
          missingSince: item.missingSince,
          nearestNeighborDist: item.nearestNeighborDist,
          wasLoneSwimmer: item.wasLoneSwimmer,
          history,
          zones,
        },
        now,
      )

      if (item.bbox && !item.isMissing) {
        history.push({
          timestamp: now,
          bbox: item.bbox,
          confidence: item.confidence,
          center: item.center,
        })
        const cutoff = now - HISTORY_DURATION_MS
        historyMapRef.current.set(
          item.id,
          history.filter((e) => e.timestamp >= cutoff),
        )
      }

      tracked.push({
        id: item.id,
        bbox: item.bbox,
        confidence: item.confidence,
        center: item.center,
        isMissing: item.isMissing,
        riskScore: result.score,
        riskState: result.state,
        contributors: result.contributors,
      })
    }

    tracked.sort((a, b) => b.riskScore - a.riskScore)
    const highest = tracked[0]
    const maxScore = highest?.riskScore ?? 0
    const maxState = highest?.riskState ?? 'SAFE'
    const maxContributors = highest?.contributors ?? {
      submersion: 0,
      stasis: 0,
      disappearance: 0,
      distress: 0,
    }

    recorderRef.current.pushFrame(
      now,
      tracked.map((p) => ({
        bbox: p.bbox,
        center: p.center,
        isMissing: p.isMissing,
        riskScore: p.riskScore,
      })),
      maxScore,
    )

    setPeople(tracked)
    setRiskScore(maxScore)
    setRiskState(maxState)
    setContributors(maxContributors)
    setHighestRiskPersonId(highest?.id ?? null)

    const duration = recorderRef.current.trackHighRiskDuration(now, maxScore)
    setHighRiskDurationMs(duration)

    if (maxScore > ALERT_THRESHOLD) {
      if (
        !peakAtAlertRef.current ||
        maxScore > peakAtAlertRef.current.person.riskScore
      ) {
        peakAtAlertRef.current = { person: highest }
      }

      if (duration >= ALERT_DURATION_MS && !hasTriggeredAlertRef.current) {
        hasTriggeredAlertRef.current = true
        setIsAlerting(true)
        alertSoundRef.current.start()

        const peak = peakAtAlertRef.current?.person ?? highest
        recorderRef.current.snapshotIncident(
          peak.contributors,
          peak.riskScore,
          peak.id,
        )
        setIncidents(recorderRef.current.getIncidents())
      }
    } else {
      hasTriggeredAlertRef.current = false
      peakAtAlertRef.current = null
      recorderRef.current.resetHighRiskTracking()
      setIsAlerting(false)
      alertSoundRef.current.stop()
    }
  }, [detections, isMonitoring, zones, resetAlert])

  useEffect(() => {
    return () => {
      alertSoundRef.current.dispose()
    }
  }, [])

  return {
    people,
    riskScore,
    riskState,
    contributors,
    highestRiskPersonId,
    isAlerting,
    highRiskDurationMs,
    incidents,
    resetAlert,
  }
}
