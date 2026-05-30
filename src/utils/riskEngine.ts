import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { PoseHistoryEntry, RiskResult } from '../types/risk'
import { getRiskState } from '../types/risk'
import { POSE_LANDMARK } from '../types/pose'
import { averageDisplacement, getTorsoMidpoints } from './poseMath'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Torso angle from horizontal: 0° = lying flat, 90° = upright */
export function getTorsoAngleDeg(landmarks: NormalizedLandmark[]): number | null {
  const midpoints = getTorsoMidpoints(landmarks)
  if (!midpoints) return null

  const { shoulderMid, hipMid } = midpoints
  const dx = shoulderMid.x - hipMid.x
  const dy = shoulderMid.y - hipMid.y
  return Math.abs((Math.atan2(-dy, dx) * 180) / Math.PI)
}

/**
 * 0 when lying down, 1 when upright. Drowning distress signals only apply
 * when the body is roughly vertical in the water — not when recumbent on a floor.
 */
function uprightFactor(torsoAngleDeg: number | null): number {
  if (torsoAngleDeg === null) return 0
  return clamp((torsoAngleDeg - 40) / 35, 0, 1)
}

function computeVerticalScore(torsoAngleDeg: number | null): number {
  if (torsoAngleDeg === null) return 0
  return clamp(((torsoAngleDeg - 20) / 50) * 100, 0, 100)
}

function computeArmsScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  // Arms-below-shoulders is normal when lying on a floor — require upright torso
  if (torsoAngleDeg === null || torsoAngleDeg < 55) return 0

  const ls = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  const lw = landmarks[POSE_LANDMARK.LEFT_WRIST]
  const rw = landmarks[POSE_LANDMARK.RIGHT_WRIST]

  if (!ls || !rs || !lw || !rw) return 0

  const margin = 0.04
  const leftBelow =
    lw.y > ls.y + margin && (lw.visibility ?? 1) > 0.5
  const rightBelow =
    rw.y > rs.y + margin && (rw.visibility ?? 1) > 0.5

  if (leftBelow && rightBelow) return 100
  if (leftBelow || rightBelow) return 50
  return 0
}

function computeSubmersionScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  // Low visibility from a floor angle ≠ submerged legs in water
  if (torsoAngleDeg === null || torsoAngleDeg < 45) return 0

  const nose = landmarks[POSE_LANDMARK.NOSE]
  const ls = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  const lh = landmarks[POSE_LANDMARK.LEFT_HIP]
  const rh = landmarks[POSE_LANDMARK.RIGHT_HIP]
  const la = landmarks[POSE_LANDMARK.LEFT_ANKLE]
  const ra = landmarks[POSE_LANDMARK.RIGHT_ANKLE]

  if (!nose || !ls || !rs || !lh || !rh || !la || !ra) return 0

  const headVis =
    ((nose.visibility ?? 1) + (ls.visibility ?? 1) + (rs.visibility ?? 1)) / 3
  const hipVis = ((lh.visibility ?? 1) + (rh.visibility ?? 1)) / 2
  const ankleVis = ((la.visibility ?? 1) + (ra.visibility ?? 1)) / 2

  // Drowning pattern: head clearly visible, lower body hidden underwater
  if (headVis < 0.6) return 0
  if (hipVis > 0.7) return 0

  return clamp((1 - hipVis) * 40 + (1 - ankleVis) * 60, 0, 100)
}

function computeStasisScore(
  landmarks: NormalizedLandmark[],
  history: PoseHistoryEntry[],
  now: number,
  upright: number,
): number {
  if (upright < 0.3) return 0

  const threeSecondsAgo = now - 3000
  const pastEntry = history.find((entry) => entry.timestamp <= threeSecondsAgo)

  if (!pastEntry) return 0

  const displacement = averageDisplacement(landmarks, pastEntry.landmarks)
  const raw = clamp(1 - displacement / 0.03, 0, 1) * 100

  // Stillness only matters when upright; lying still on a floor is not distress
  return raw * upright
}

export function computeRisk(
  landmarks: NormalizedLandmark[] | null,
  history: PoseHistoryEntry[],
  now = performance.now(),
): RiskResult {
  if (!landmarks || landmarks.length < 33) {
    return {
      score: 0,
      state: 'SAFE',
      contributors: { vertical: 0, arms: 0, submersion: 0, stasis: 0 },
    }
  }

  const torsoAngle = getTorsoAngleDeg(landmarks)
  const upright = uprightFactor(torsoAngle)

  const verticalScore = computeVerticalScore(torsoAngle)
  const armsScore = computeArmsScore(landmarks, torsoAngle)
  const submersionScore = computeSubmersionScore(landmarks, torsoAngle)
  const stasisScore = computeStasisScore(landmarks, history, now, upright)

  const contributors = {
    vertical: Math.round(verticalScore * 0.4),
    arms: Math.round(armsScore * 0.25),
    submersion: Math.round(submersionScore * 0.25),
    stasis: Math.round(stasisScore * 0.1),
  }

  let score = clamp(
    contributors.vertical +
      contributors.arms +
      contributors.submersion +
      contributors.stasis,
    0,
    100,
  )

  // Recumbent on floor/deck: cap well below CAUTION even if individual signals misfire
  if (torsoAngle !== null && torsoAngle < 40) {
    score = Math.min(score, 25)
  }

  // Active movement (scooting, flailing) — not passive drowning stasis
  if (history.length > 0) {
    const threeSecondsAgo = now - 3000
    const pastEntry = history.find((e) => e.timestamp <= threeSecondsAgo)
    if (pastEntry) {
      const displacement = averageDisplacement(landmarks, pastEntry.landmarks)
      if (displacement > 0.012) {
        score = Math.min(score, 35)
      }
    }
  }

  return {
    score,
    state: getRiskState(score),
    contributors,
  }
}
