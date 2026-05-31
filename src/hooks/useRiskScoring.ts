import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '../types/pose'
import type { TrackedPerson } from '../types/person'
import type { Incident } from '../types/pose'
import type { PoseHistoryEntry, RiskResult, RiskState } from '../types/risk'
import { getRiskState } from '../types/risk'
import { AlertSound } from '../utils/alertSound'
import { PersonTracker } from '../utils/personTracker'
import { computeRisk } from '../utils/riskEngine'
import { ReplayRecorder } from '../utils/replayRecorder'
import { getTorsoMidpoints } from '../utils/poseMath'

const ALERT_THRESHOLD = 70
const ALERT_DURATION_MS = 4000
const HISTORY_DURATION_MS = 5000
const TREND_WINDOW_MS = 5000

// Ghost tracking constants
// When pose detection is lost, risk escalates at this rate (points/second).
// Person at WATCH (40%) → ALERT (70%) in 6 s. At WARNING (55%) → ALERT in 3 s.
const GHOST_ESCALATION_RATE = 5      // pts/s
const GHOST_MAX_SCORE = 92           // cap — we're sure, not certain they're dead
const GHOST_MIN_ENTRY_SCORE = 40     // only create ghost if they were at least WATCH
const GHOST_MAX_MISSING_MS = 20_000  // stop escalating / clear ghost after 20 s

interface ScoreEntry { timestamp: number; score: number }

interface GhostEntry {
  id: number
  scoreAtDisappearance: number
  stateAtDisappearance: RiskState
  lastSeenAt: number
  landmarks: NormalizedLandmark[]       // last known landmarks for replay/rendering
  contributors: RiskResult['contributors']
}

function computeTrendMultiplier(history: ScoreEntry[], now: number): number {
  if (history.length < 6) return 1
  const mid = now - TREND_WINDOW_MS / 2
  const early = history.filter((e) => e.timestamp < mid)
  const late  = history.filter((e) => e.timestamp >= mid)
  if (!early.length || !late.length) return 1
  const earlyAvg = early.reduce((s, e) => s + e.score, 0) / early.length
  const lateAvg  = late.reduce((s, e) => s + e.score, 0) / late.length
  const rise = lateAvg - earlyAvg
  return rise <= 8 ? 1 : Math.min(1.2, 1 + rise / 100)
}

interface UseRiskScoringResult {
  people: TrackedPerson[]
  riskScore: number
  riskState: RiskState
  contributors: RiskResult['contributors']
  highestRiskPersonId: number | null
  isAlerting: boolean
  highRiskDurationMs: number
  watchDurationMs: number
  incidents: Incident[]
  resetAlert: () => void
}

export function useRiskScoring(
  poses: NormalizedLandmark[][],
  isMonitoring: boolean,
): UseRiskScoringResult {
  const recorderRef       = useRef(new ReplayRecorder())
  const alertSoundRef     = useRef(new AlertSound())
  const trackerRef        = useRef(new PersonTracker())
  const historyMapRef     = useRef<Map<number, PoseHistoryEntry[]>>(new Map())
  const scoreHistoryMapRef= useRef<Map<number, ScoreEntry[]>>(new Map())
  const ghostMapRef       = useRef<Map<number, GhostEntry>>(new Map())
  const hasTriggeredAlertRef = useRef(false)
  const peakAtAlertRef    = useRef<{ person: TrackedPerson } | null>(null)
  const watchStartRef     = useRef<number | null>(null)

  const [people, setPeople]                   = useState<TrackedPerson[]>([])
  const [riskScore, setRiskScore]             = useState(0)
  const [riskState, setRiskState]             = useState<RiskState>('SAFE')
  const [contributors, setContributors]       = useState<RiskResult['contributors']>(
    { vertical: 0, arms: 0, submersion: 0, stasis: 0 },
  )
  const [highestRiskPersonId, setHighestRiskPersonId] = useState<number | null>(null)
  const [isAlerting, setIsAlerting]           = useState(false)
  const [highRiskDurationMs, setHighRiskDurationMs]   = useState(0)
  const [watchDurationMs, setWatchDurationMs] = useState(0)
  const [incidents, setIncidents]             = useState<Incident[]>([])

  const resetAlert = useCallback(() => {
    hasTriggeredAlertRef.current = false
    peakAtAlertRef.current = null
    watchStartRef.current = null
    recorderRef.current.resetHighRiskTracking()
    setIsAlerting(false)
    setWatchDurationMs(0)
    alertSoundRef.current.stop()
  }, [])

  useEffect(() => {
    if (!isMonitoring) {
      resetAlert()
      trackerRef.current.reset()
      historyMapRef.current.clear()
      scoreHistoryMapRef.current.clear()
      ghostMapRef.current.clear()
      setPeople([])
      setRiskScore(0)
      setRiskState('SAFE')
      setContributors({ vertical: 0, arms: 0, submersion: 0, stasis: 0 })
      setHighestRiskPersonId(null)
      setHighRiskDurationMs(0)
      setWatchDurationMs(0)
      return
    }

    const now = performance.now()

    // ── 1. Score currently detected persons ────────────────────────────────
    const ids = poses.length > 0
      ? trackerRef.current.assignIds(poses, now)
      : []

    const activeIds = new Set<number>()
    const tracked: TrackedPerson[] = []

    for (let i = 0; i < poses.length; i++) {
      const id        = ids[i]
      const landmarks = poses[i]
      const history   = historyMapRef.current.get(id) ?? []
      const baseResult = computeRisk(landmarks, history, now)

      // Trend amplification
      const scoreHistory = scoreHistoryMapRef.current.get(id) ?? []
      scoreHistory.push({ timestamp: now, score: baseResult.score })
      const trimmed = scoreHistory.filter((e) => e.timestamp >= now - TREND_WINDOW_MS)
      scoreHistoryMapRef.current.set(id, trimmed)

      const finalScore = Math.min(100, baseResult.score * computeTrendMultiplier(trimmed, now))

      history.push({ timestamp: now, landmarks })
      historyMapRef.current.set(
        id,
        history.filter((e) => e.timestamp >= now - HISTORY_DURATION_MS),
      )

      activeIds.add(id)

      // Update / clear ghost if this person is visible again
      if (ghostMapRef.current.has(id)) {
        ghostMapRef.current.delete(id)
      }

      tracked.push({
        id,
        landmarks,
        riskScore: finalScore,
        riskState: baseResult.state,
        contributors: baseResult.contributors,
        isGhost: false,
      })

      // Update ghost entry baseline with current state (so if they vanish, we know where they were)
      if (finalScore >= GHOST_MIN_ENTRY_SCORE) {
        ghostMapRef.current.set(id, {
          id,
          scoreAtDisappearance: finalScore,
          stateAtDisappearance: baseResult.state,
          lastSeenAt: now,
          landmarks,
          contributors: baseResult.contributors,
        })
      } else {
        // Score dropped below threshold — person is safe, remove any ghost entry
        ghostMapRef.current.delete(id)
      }
    }

    // ── 1b. Proximity eviction: clear ghosts that overlap a live person ────
    // This handles the case where a re-emerging swimmer got a new ID instead of their
    // original one — the stale ghost stays alive until it's spatially overlapping the
    // live detection, at which point we know it's the same physical person.
    if (ghostMapRef.current.size > 0) {
      for (const [ghostId, entry] of ghostMapRef.current) {
        if (activeIds.has(ghostId)) continue  // already cleared above
        const ghostHip = getTorsoMidpoints(entry.landmarks)?.hipMid
        if (!ghostHip) continue
        for (const liveP of tracked) {
          const liveHip = getTorsoMidpoints(liveP.landmarks)?.hipMid
          if (!liveHip) continue
          const dx = ghostHip.x - liveHip.x
          const dy = ghostHip.y - liveHip.y
          if (dx * dx + dy * dy < 0.09) {  // within ~0.3 normalised = same-body zone
            ghostMapRef.current.delete(ghostId)
            break
          }
        }
      }
    }

    // ── 2. Resolve ghost persons (lost tracking while at elevated risk) ────
    const ghosts: TrackedPerson[] = []

    for (const [ghostId, entry] of ghostMapRef.current) {
      if (activeIds.has(ghostId)) continue  // currently visible — not a ghost

      const missingMs = now - entry.lastSeenAt

      if (missingMs > GHOST_MAX_MISSING_MS) {
        ghostMapRef.current.delete(ghostId)
        continue
      }

      // Escalate: every second underwater adds GHOST_ESCALATION_RATE points
      const ghostScore = Math.min(
        GHOST_MAX_SCORE,
        entry.scoreAtDisappearance + (missingMs / 1000) * GHOST_ESCALATION_RATE,
      )

      ghosts.push({
        id: ghostId,
        landmarks: entry.landmarks,     // last known pose for skeleton rendering
        riskScore: ghostScore,
        riskState: getRiskState(ghostScore),
        contributors: entry.contributors,
        isGhost: true,
        missingMs,
      })
    }

    // ── 3. Merge visible + ghost persons for downstream scoring ───────────
    const allPeople = [...tracked, ...ghosts].sort((a, b) => b.riskScore - a.riskScore)
    const highest   = allPeople[0]
    const maxScore  = highest?.riskScore ?? 0
    const maxState  = highest?.riskState ?? 'SAFE'
    const maxContributors = highest?.contributors ?? { vertical: 0, arms: 0, submersion: 0, stasis: 0 }

    recorderRef.current.pushFrame(
      now,
      allPeople.map((p) => ({ landmarks: p.landmarks, riskScore: p.riskScore })),
      maxScore,
    )

    setPeople(allPeople)
    setRiskScore(maxScore)
    setRiskState(maxState)
    setContributors(maxContributors)
    setHighestRiskPersonId(highest?.id ?? null)

    // Watch duration (score ≥ 40)
    if (maxScore >= 40) {
      if (watchStartRef.current === null) watchStartRef.current = now
      setWatchDurationMs(now - watchStartRef.current)
    } else {
      watchStartRef.current = null
      setWatchDurationMs(0)
    }

    const duration = recorderRef.current.trackHighRiskDuration(now, maxScore)
    setHighRiskDurationMs(duration)

    if (maxScore > ALERT_THRESHOLD) {
      if (!peakAtAlertRef.current || maxScore > peakAtAlertRef.current.person.riskScore) {
        peakAtAlertRef.current = { person: highest }
      }
      if (duration >= ALERT_DURATION_MS && !hasTriggeredAlertRef.current) {
        hasTriggeredAlertRef.current = true
        setIsAlerting(true)
        alertSoundRef.current.start()
        const peak = peakAtAlertRef.current?.person ?? highest
        recorderRef.current.snapshotIncident(peak.contributors, peak.riskScore, peak.id)
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
    return () => { alertSoundRef.current.dispose() }
  }, [])

  return {
    people,
    riskScore,
    riskState,
    contributors,
    highestRiskPersonId,
    isAlerting,
    highRiskDurationMs,
    watchDurationMs,
    incidents,
    resetAlert,
  }
}
