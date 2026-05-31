import type { NormalizedBBox } from '../types/detection'
import type { DetectionHistoryEntry } from './detectionTracker'
import {
  isLoneSwimmer,
  isSafeBystander,
  postureExtremeness,
} from './poolPosture'
import type { RiskResult } from '../types/risk'
import { getRiskState } from '../types/risk'
import type { Zone } from '../types/zone'
import { zoneVerdict } from '../types/zone'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function centerDisplacement(
  current: { x: number; y: number },
  past: { x: number; y: number },
): number {
  const dx = current.x - past.x
  const dy = current.y - past.y
  return Math.sqrt(dx * dx + dy * dy)
}

function averageCenterDisplacement(
  current: { x: number; y: number },
  history: DetectionHistoryEntry[],
  now: number,
  windowMs: number,
): number {
  const cutoff = now - windowMs
  const past = history.find((e) => e.timestamp <= cutoff)
  if (!past) return Infinity
  return centerDisplacement(current, past.center)
}

function computeSubmersionScore(confidence: number): number {
  return clamp((0.65 - confidence) / 0.4, 0, 1) * 100
}

function computeStasisScore(
  center: { x: number; y: number },
  history: DetectionHistoryEntry[],
  now: number,
): number {
  const displacement = averageCenterDisplacement(center, history, now, 3000)
  if (!Number.isFinite(displacement)) return 0
  return clamp((1 - displacement / 0.035) * 100, 0, 100)
}

function computeDisappearanceScore(
  missingSince: number | null,
  now: number,
): number {
  if (missingSince === null) return 0
  const missingMs = now - missingSince
  if (missingMs < 1500) return 0
  return clamp(((missingMs - 1500) / 2500) * 100, 0, 100)
}

export interface RiskInput {
  bbox: NormalizedBBox | null
  confidence: number
  center: { x: number; y: number }
  isMissing: boolean
  missingSince: number | null
  nearestNeighborDist: number
  wasLoneSwimmer: boolean
  history: DetectionHistoryEntry[]
  zones: Zone[]
}

const SAFE: RiskResult = {
  score: 0,
  state: 'SAFE',
  contributors: { submersion: 0, stasis: 0, disappearance: 0, distress: 0 },
}

/** Calibrated safe zone — never alert, no exceptions. */
function safeZoneResult(): RiskResult {
  return SAFE
}

/** Calibrated monitor zone — aggressive scoring for demo calibration. */
function monitorZoneResult(
  bbox: NormalizedBBox | null,
  confidence: number,
  center: { x: number; y: number },
  history: DetectionHistoryEntry[],
  isMissing: boolean,
  missingSince: number | null,
  now: number,
): RiskResult {
  if (isMissing) {
    const missingMs = missingSince !== null ? now - missingSince : 0
    const score = missingMs >= 800 ? 98 : 92
    return {
      score,
      state: 'CRITICAL',
      contributors: {
        submersion: 0,
        stasis: 0,
        disappearance: score,
        distress: 0,
      },
    }
  }

  if (!bbox) return SAFE

  const move1s = averageCenterDisplacement(center, history, now, 1000)
  const move2s = averageCenterDisplacement(center, history, now, 2000)
  const isMoving =
    (Number.isFinite(move1s) && move1s > 0.004) ||
    (Number.isFinite(move2s) && move2s > 0.008)

  // Anyone moving in a monitor zone is treated as critical.
  if (isMoving) {
    const score = clamp(90 + (move2s !== Infinity ? move2s * 120 : 0), 90, 99)
    return {
      score,
      state: 'CRITICAL',
      contributors: {
        submersion: 0,
        stasis: 0,
        disappearance: 0,
        distress: Math.round(score),
      },
    }
  }

  // Stationary but present in monitor — still elevated (float / distress).
  const stillness = computeStasisScore(center, history, now)
  const posture = postureExtremeness(bbox) * 100
  const score = clamp(82 + stillness * 0.1 + posture * 0.08, 82, 94)

  return {
    score,
    state: getRiskState(score),
    contributors: {
      submersion: Math.round(computeSubmersionScore(confidence) * 0.15),
      stasis: Math.round(stillness * 0.25),
      disappearance: 0,
      distress: Math.round(score * 0.6),
    },
  }
}

function disappearanceResult(missingSince: number | null, now: number): RiskResult {
  const disappearanceScore = computeDisappearanceScore(missingSince, now)
  let score = disappearanceScore
  if (missingSince !== null && now - missingSince >= 3500) {
    score = Math.max(score, 80)
  }
  return {
    score,
    state: getRiskState(score),
    contributors: {
      submersion: 0,
      stasis: 0,
      disappearance: Math.round(disappearanceScore),
      distress: 0,
    },
  }
}

function swimmerResult(
  bbox: NormalizedBBox,
  confidence: number,
  center: { x: number; y: number },
  history: DetectionHistoryEntry[],
  now: number,
): RiskResult {
  const weakSignal = computeSubmersionScore(confidence)
  const stillness = computeStasisScore(center, history, now)
  const posture = postureExtremeness(bbox) * 100

  const BASELINE = 35
  let score = clamp(
    BASELINE + stillness * 0.45 + posture * 0.3 + weakSignal * 0.2,
    0,
    100,
  )

  const displacement = averageCenterDisplacement(center, history, now, 2000)
  if (Number.isFinite(displacement) && displacement > 0.09) {
    score = Math.min(score, 30)
  }

  return {
    score,
    state: getRiskState(score),
    contributors: {
      submersion: Math.round(weakSignal * 0.2),
      stasis: Math.round(stillness * 0.45),
      disappearance: 0,
      distress: Math.round(BASELINE + posture * 0.3),
    },
  }
}

export function computeRisk(
  input: RiskInput,
  now = performance.now(),
): RiskResult {
  const {
    bbox,
    confidence,
    center,
    isMissing,
    missingSince,
    nearestNeighborDist,
    wasLoneSwimmer,
    history,
    zones,
  } = input

  const verdict = zoneVerdict(zones, center)

  // Safe zone always wins — guaranteed no alert.
  if (verdict === 'safe') return safeZoneResult()

  // Monitor zone — calibrated aggressive detection.
  if (verdict === 'monitor') {
    return monitorZoneResult(
      bbox,
      confidence,
      center,
      history,
      isMissing,
      missingSince,
      now,
    )
  }

  if (isMissing) {
    if (!wasLoneSwimmer) return SAFE
    return disappearanceResult(missingSince, now)
  }

  if (!bbox) return SAFE

  if (isSafeBystander(bbox, center, nearestNeighborDist)) return SAFE
  if (!isLoneSwimmer(bbox, center, nearestNeighborDist)) return SAFE

  return swimmerResult(bbox, confidence, center, history, now)
}
