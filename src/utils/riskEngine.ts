import type { NormalizedLandmark } from '../types/pose'
import type { PoseHistoryEntry, RiskResult } from '../types/risk'
import { getRiskState } from '../types/risk'
import { POSE_LANDMARK } from '../types/pose'
import { euclideanDistance, getTorsoMidpoints } from './poseMath'

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

function uprightFactor(torsoAngleDeg: number | null): number {
  if (torsoAngleDeg === null) return 0
  return clamp((torsoAngleDeg - 40) / 35, 0, 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE A — FACE-DOWN / HORIZONTAL
// Covers: child falls in, unconscious person, prone submersion.
// The most common real-world drowning pattern. Completely separate from IDR.
//
// Key distinction: face-UP horizontal = safe (floating on back).
//                  face-DOWN horizontal = emergency.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns how "face-down" the person is: nose below shoulder midpoint.
 * In image coords y increases downward, so nose.y > shoulderMidY = face down.
 * Also fires when the nose keypoint is missing while body is detected (head submerged).
 */
function computeFaceDownScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  // Upright people can't be face-down in the meaningful sense
  if (torsoAngleDeg !== null && torsoAngleDeg > 72) return 0

  const nose = landmarks[POSE_LANDMARK.NOSE]
  const ls   = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs   = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]

  if (!ls || !rs) return 0

  const shoulderMidY = (ls.y + rs.y) / 2

  // Head submerged: body detected but nose missing → strong signal
  if (!nose || (nose.visibility ?? 1) < 0.25) {
    const shoulderVis = ((ls.visibility ?? 1) + (rs.visibility ?? 1)) / 2
    if (shoulderVis > 0.5 && torsoAngleDeg !== null && torsoAngleDeg < 50) return 80
    return 0
  }

  // Nose below shoulder midpoint = face pointing toward the water
  const faceDownAmount = nose.y - shoulderMidY
  if (faceDownAmount <= 0.02) return 0
  if (faceDownAmount >= 0.10) return 100
  return clamp(((faceDownAmount - 0.02) / 0.08) * 100, 0, 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE B — UPRIGHT / IDR (Instinctive Drowning Response)
// Covers: adult in deep water, vertical, arms pressing at surface, sinking.
// ─────────────────────────────────────────────────────────────────────────────

function computeVerticalScore(torsoAngleDeg: number | null): number {
  if (torsoAngleDeg === null) return 0
  return clamp(((torsoAngleDeg - 20) / 50) * 100, 0, 100)
}

/**
 * IDR arm press: wrists near shoulder height, elbows angling down.
 * Arm raised above head = waving (opposite of IDR) → subtract points.
 */
function computeArmsScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  if (torsoAngleDeg === null || torsoAngleDeg < 55) return 0

  const ls = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  const le = landmarks[POSE_LANDMARK.LEFT_ELBOW]
  const re = landmarks[POSE_LANDMARK.RIGHT_ELBOW]
  const lw = landmarks[POSE_LANDMARK.LEFT_WRIST]
  const rw = landmarks[POSE_LANDMARK.RIGHT_WRIST]

  if (!ls || !rs) return 0

  const checkArm = (
    shoulder: NormalizedLandmark,
    elbow: NormalizedLandmark | undefined,
    wrist: NormalizedLandmark | undefined,
  ): number => {
    if (!wrist || (wrist.visibility ?? 1) < 0.4) return 0
    if (wrist.y < shoulder.y - 0.12) return -15  // waving above head → not IDR
    const atSurface = Math.abs(wrist.y - shoulder.y) < 0.15
    const pressing  = !elbow || (elbow.visibility ?? 1) < 0.3 ? true : elbow.y >= wrist.y
    if (atSurface && pressing) return 50
    if (wrist.y > shoulder.y + 0.04) return 25
    return 0
  }

  return clamp(checkArm(ls, le, lw) + checkArm(rs, re, rw), 0, 100)
}

/**
 * Head at surface: nose approaching shoulder height = head tilted back, mouth at water.
 * Normal upright: nose 0.18+ above shoulders. IDR: drops toward 0.05.
 */
function computeHeadAtSurfaceScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  if (torsoAngleDeg === null || torsoAngleDeg < 55) return 0

  const nose = landmarks[POSE_LANDMARK.NOSE]
  const ls   = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs   = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  if (!nose || !ls || !rs) return 0
  if ((nose.visibility ?? 1) < 0.45) return 0
  if ((ls.visibility ?? 1) < 0.4 || (rs.visibility ?? 1) < 0.4) return 0

  const shoulderMidY = (ls.y + rs.y) / 2
  const headRise = shoulderMidY - nose.y

  if (headRise >= 0.18) return 0
  if (headRise <= 0.05) return 80

  const headScore = clamp(((0.18 - headRise) / 0.13) * 80, 0, 80)
  const legHang   = computeLegHangScore(landmarks, torsoAngleDeg)
  return clamp(headScore + legHang * 0.25, 0, 100)
}

function computeLegHangScore(
  landmarks: NormalizedLandmark[],
  torsoAngleDeg: number | null,
): number {
  if (torsoAngleDeg === null || torsoAngleDeg < 55) return 0
  const lh = landmarks[POSE_LANDMARK.LEFT_HIP]
  const rh = landmarks[POSE_LANDMARK.RIGHT_HIP]
  if (!lh || !rh) return 0
  const hipMidX = (lh.x + rh.x) / 2, hipMidY = (lh.y + rh.y) / 2
  let aligned = 0, total = 0
  const check = (lm: NormalizedLandmark | undefined, rx: number, ry: number) => {
    if (!lm || (lm.visibility ?? 1) < 0.3) return
    total++
    if (lm.y > ry && Math.abs(lm.x - rx) < 0.13) aligned++
  }
  check(landmarks[POSE_LANDMARK.LEFT_KNEE],   lh.x,    lh.y)
  check(landmarks[POSE_LANDMARK.RIGHT_KNEE],  rh.x,    rh.y)
  check(landmarks[POSE_LANDMARK.LEFT_ANKLE],  hipMidX, hipMidY)
  check(landmarks[POSE_LANDMARK.RIGHT_ANKLE], hipMidX, hipMidY)
  return total === 0 ? 0 : (aligned / total) * 100
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL SIGNALS (both modes)
// ─────────────────────────────────────────────────────────────────────────────

/** Head descent: body-relative nose position dropping over ~3.5 seconds. */
function computeHeadDescentScore(
  landmarks: NormalizedLandmark[],
  history: PoseHistoryEntry[],
  now: number,
): number {
  const nose = landmarks[POSE_LANDMARK.NOSE]
  const ls   = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs   = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  if (!nose || !ls || !rs) return 0
  if ((nose.visibility ?? 1) < 0.4 || (ls.visibility ?? 1) < 0.4) return 0

  const headRiseNow = (ls.y + rs.y) / 2 - nose.y
  const past = history.findLast((e) => e.timestamp <= now - 3500)
  if (!past) return 0

  const pNose = past.landmarks[POSE_LANDMARK.NOSE]
  const pLs   = past.landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const pRs   = past.landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  if (!pNose || !pLs || !pRs || (pNose.visibility ?? 1) < 0.4) return 0

  const headRisePast = (pLs.y + pRs.y) / 2 - pNose.y
  const descent = headRisePast - headRiseNow

  if (descent <= 0.01) return 0
  if (descent >= 0.10) return 100
  return clamp((descent / 0.10) * 100, 0, 100)
}

/**
 * Arm range: small wrist travel range = arms locked at surface (IDR).
 * Large range = active sculling = treading water (safe).
 */
function computeArmRangeScore(history: PoseHistoryEntry[]): number {
  const ys: number[] = []
  for (const e of history) {
    const lw = e.landmarks[POSE_LANDMARK.LEFT_WRIST]
    const rw = e.landmarks[POSE_LANDMARK.RIGHT_WRIST]
    if (lw && (lw.visibility ?? 1) > 0.3) ys.push(lw.y)
    if (rw && (rw.visibility ?? 1) > 0.3) ys.push(rw.y)
  }
  if (ys.length < 5) return 0
  const range = Math.max(...ys) - Math.min(...ys)
  if (range >= 0.25) return 0
  if (range <= 0.08) return 100
  return clamp(((0.25 - range) / 0.17) * 100, 0, 100)
}

const TORSO_LANDMARKS = [
  POSE_LANDMARK.NOSE,
  POSE_LANDMARK.LEFT_SHOULDER,
  POSE_LANDMARK.RIGHT_SHOULDER,
  POSE_LANDMARK.LEFT_HIP,
  POSE_LANDMARK.RIGHT_HIP,
] as const

/**
 * Torso stasis: how little the core body has moved over 3 seconds.
 * isFaceDown = true → fires even when horizontal (face-down + not moving = emergency).
 * isFaceDown = false + horizontal → skip (floating on back is fine).
 */
function computeStasisScore(
  landmarks: NormalizedLandmark[],
  history: PoseHistoryEntry[],
  now: number,
  upright: number,
  isFaceDown: boolean,
): number {
  if (upright < 0.3 && !isFaceDown) return 0

  const past = history.findLast((e) => e.timestamp <= now - 3000)
  if (!past) return 0

  let total = 0, count = 0
  for (const idx of TORSO_LANDMARKS) {
    const c = landmarks[idx]
    const p = past.landmarks[idx]
    if (!c || !p) continue
    if ((c.visibility ?? 1) < 0.4 || (p.visibility ?? 1) < 0.4) continue
    total += euclideanDistance({ x: c.x, y: c.y }, { x: p.x, y: p.y })
    count++
  }
  if (count === 0) return 0

  const raw = clamp(1 - (total / count) / 0.025, 0, 1) * 100
  return isFaceDown ? raw : raw * upright
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE
// ─────────────────────────────────────────────────────────────────────────────

export function computeRisk(
  landmarks: NormalizedLandmark[] | null,
  history: PoseHistoryEntry[],
  now = performance.now(),
): RiskResult {
  if (!landmarks || landmarks.length < 17) {
    return { score: 0, state: 'SAFE', contributors: { vertical: 0, arms: 0, submersion: 0, stasis: 0 } }
  }

  const torsoAngle = getTorsoAngleDeg(landmarks)
  const upright    = uprightFactor(torsoAngle)

  // ── Face-down score (works at any orientation, dominant when horizontal)
  const faceDownScore = computeFaceDownScore(landmarks, torsoAngle)
  const isFaceDown    = faceDownScore > 25
  const isHorizontal  = torsoAngle !== null && torsoAngle < 45

  // ── Upright signals
  const verticalScore    = computeVerticalScore(torsoAngle)
  const armsScore        = computeArmsScore(landmarks, torsoAngle)
  const headSurfaceScore = computeHeadAtSurfaceScore(landmarks, torsoAngle)
  const headDescentScore = computeHeadDescentScore(landmarks, history, now)

  // ── Temporal signals
  const stasisScore   = computeStasisScore(landmarks, history, now, upright, isFaceDown)
  const armRangeScore = computeArmRangeScore(history)

  // ── Blend: submersion slot switches between face-down and head-position signal
  const submersionBlended = isHorizontal
    ? faceDownScore                                          // horizontal → face-down dominates
    : headSurfaceScore * 0.55 + headDescentScore * 0.45     // upright → IDR head position

  // ── Stasis slot: arm-range only meaningful when upright
  const stasisBlended = stasisScore * 0.55 + (isHorizontal ? 0 : armRangeScore * 0.45)

  // Weight budget: 30 + 15 + 30 + 25 = 100
  const contributors = {
    vertical:   Math.round(verticalScore      * 0.30),
    arms:       Math.round(armsScore          * 0.15),
    submersion: Math.round(submersionBlended  * 0.30),
    stasis:     Math.round(stasisBlended      * 0.25),
  }

  let score = clamp(
    contributors.vertical +
    contributors.arms +
    contributors.submersion +
    contributors.stasis,
    0, 100,
  )

  // ── Orientation guard
  if (torsoAngle !== null && torsoAngle < 40) {
    if (!isFaceDown) {
      // Face-UP horizontal = floating on back, lying on deck → safe
      score = Math.min(score, 25)
    }
    // Face-DOWN horizontal: do NOT cap — this is the emergency scenario from the clips
  }

  // ── Active forward-swimming guard (shoulders moving intentionally)
  // Only applies when upright — a horizontal swimmer in laps moves shoulders too
  if (!isHorizontal && history.length > 0) {
    const past = history.findLast((e) => e.timestamp <= now - 2000)
    if (past) {
      const lsN = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
      const rsN = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
      const lsP = past.landmarks[POSE_LANDMARK.LEFT_SHOULDER]
      const rsP = past.landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
      let disp = 0, n = 0
      if (lsN && lsP) { disp += euclideanDistance({ x: lsN.x, y: lsN.y }, { x: lsP.x, y: lsP.y }); n++ }
      if (rsN && rsP) { disp += euclideanDistance({ x: rsN.x, y: rsN.y }, { x: rsP.x, y: rsP.y }); n++ }
      if (n > 0 && disp / n > 0.020) score = Math.min(score, 30)
    }
  }

  return { score, state: getRiskState(score), contributors }
}
