import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { TrackedPerson } from '../types/person'
import type { Incident } from '../types/pose'
import type { PoseHistoryEntry, RiskResult, RiskState } from '../types/risk'
import { AlertSound } from '../utils/alertSound'
import { PersonTracker } from '../utils/personTracker'
import { computeRisk } from '../utils/riskEngine'
import { ReplayRecorder } from '../utils/replayRecorder'

const ALERT_THRESHOLD = 65
const ALERT_DURATION_MS = 4000
const HISTORY_DURATION_MS = 3000

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
  poses: NormalizedLandmark[][],
  isMonitoring: boolean,
): UseRiskScoringResult {
  const recorderRef = useRef(new ReplayRecorder())
  const alertSoundRef = useRef(new AlertSound())
  const trackerRef = useRef(new PersonTracker())
  const historyMapRef = useRef<Map<number, PoseHistoryEntry[]>>(new Map())
  const hasTriggeredAlertRef = useRef(false)
  const peakAtAlertRef = useRef<{ person: TrackedPerson } | null>(null)

  const [people, setPeople] = useState<TrackedPerson[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [riskState, setRiskState] = useState<RiskState>('SAFE')
  const [contributors, setContributors] = useState<RiskResult['contributors']>({
    vertical: 0,
    arms: 0,
    submersion: 0,
    stasis: 0,
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
      setContributors({ vertical: 0, arms: 0, submersion: 0, stasis: 0 })
      setHighestRiskPersonId(null)
      setHighRiskDurationMs(0)
      return
    }

    if (poses.length === 0) {
      setPeople([])
      setRiskScore(0)
      setRiskState('SAFE')
      setContributors({ vertical: 0, arms: 0, submersion: 0, stasis: 0 })
      setHighestRiskPersonId(null)
      return
    }

    const now = performance.now()
    const ids = trackerRef.current.assignIds(poses, now)
    const tracked: TrackedPerson[] = []

    for (let i = 0; i < poses.length; i++) {
      const id = ids[i]
      const landmarks = poses[i]
      const history = historyMapRef.current.get(id) ?? []
      const result = computeRisk(landmarks, history, now)

      history.push({ timestamp: now, landmarks })
      const cutoff = now - HISTORY_DURATION_MS
      historyMapRef.current.set(
        id,
        history.filter((e) => e.timestamp >= cutoff),
      )

      tracked.push({
        id,
        landmarks,
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
      vertical: 0,
      arms: 0,
      submersion: 0,
      stasis: 0,
    }

    recorderRef.current.pushFrame(
      now,
      tracked.map((p) => ({
        landmarks: p.landmarks,
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
  }, [poses, isMonitoring, resetAlert])

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
