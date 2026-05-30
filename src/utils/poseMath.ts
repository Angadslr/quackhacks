import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { POSE_LANDMARK } from '../types/pose'

export interface Point2D {
  x: number
  y: number
}

/** Landmarks used for motion-stasis tracking */
export const TRACKED_LANDMARKS = [
  POSE_LANDMARK.NOSE,
  POSE_LANDMARK.LEFT_SHOULDER,
  POSE_LANDMARK.RIGHT_SHOULDER,
  POSE_LANDMARK.LEFT_ELBOW,
  POSE_LANDMARK.RIGHT_ELBOW,
  POSE_LANDMARK.LEFT_WRIST,
  POSE_LANDMARK.RIGHT_WRIST,
  POSE_LANDMARK.LEFT_HIP,
  POSE_LANDMARK.RIGHT_HIP,
  POSE_LANDMARK.LEFT_KNEE,
  POSE_LANDMARK.RIGHT_KNEE,
  POSE_LANDMARK.LEFT_ANKLE,
  POSE_LANDMARK.RIGHT_ANKLE,
] as const

/** Full MediaPipe pose connections — head, arms/hands, torso, legs/feet */
export const SKELETON_CONNECTIONS: [number, number][] = [
  // Head
  [POSE_LANDMARK.NOSE, POSE_LANDMARK.LEFT_EYE_INNER],
  [POSE_LANDMARK.LEFT_EYE_INNER, POSE_LANDMARK.LEFT_EYE],
  [POSE_LANDMARK.LEFT_EYE, POSE_LANDMARK.LEFT_EYE_OUTER],
  [POSE_LANDMARK.LEFT_EYE_OUTER, POSE_LANDMARK.LEFT_EAR],
  [POSE_LANDMARK.NOSE, POSE_LANDMARK.RIGHT_EYE_INNER],
  [POSE_LANDMARK.RIGHT_EYE_INNER, POSE_LANDMARK.RIGHT_EYE],
  [POSE_LANDMARK.RIGHT_EYE, POSE_LANDMARK.RIGHT_EYE_OUTER],
  [POSE_LANDMARK.RIGHT_EYE_OUTER, POSE_LANDMARK.RIGHT_EAR],
  [POSE_LANDMARK.MOUTH_LEFT, POSE_LANDMARK.MOUTH_RIGHT],
  // Torso
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.RIGHT_SHOULDER],
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.LEFT_HIP],
  [POSE_LANDMARK.RIGHT_SHOULDER, POSE_LANDMARK.RIGHT_HIP],
  [POSE_LANDMARK.LEFT_HIP, POSE_LANDMARK.RIGHT_HIP],
  // Left arm + hand
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.LEFT_ELBOW],
  [POSE_LANDMARK.LEFT_ELBOW, POSE_LANDMARK.LEFT_WRIST],
  [POSE_LANDMARK.LEFT_WRIST, POSE_LANDMARK.LEFT_PINKY],
  [POSE_LANDMARK.LEFT_WRIST, POSE_LANDMARK.LEFT_INDEX],
  [POSE_LANDMARK.LEFT_WRIST, POSE_LANDMARK.LEFT_THUMB],
  [POSE_LANDMARK.LEFT_PINKY, POSE_LANDMARK.LEFT_INDEX],
  // Right arm + hand
  [POSE_LANDMARK.RIGHT_SHOULDER, POSE_LANDMARK.RIGHT_ELBOW],
  [POSE_LANDMARK.RIGHT_ELBOW, POSE_LANDMARK.RIGHT_WRIST],
  [POSE_LANDMARK.RIGHT_WRIST, POSE_LANDMARK.RIGHT_PINKY],
  [POSE_LANDMARK.RIGHT_WRIST, POSE_LANDMARK.RIGHT_INDEX],
  [POSE_LANDMARK.RIGHT_WRIST, POSE_LANDMARK.RIGHT_THUMB],
  [POSE_LANDMARK.RIGHT_PINKY, POSE_LANDMARK.RIGHT_INDEX],
  // Left leg + foot
  [POSE_LANDMARK.LEFT_HIP, POSE_LANDMARK.LEFT_KNEE],
  [POSE_LANDMARK.LEFT_KNEE, POSE_LANDMARK.LEFT_ANKLE],
  [POSE_LANDMARK.LEFT_ANKLE, POSE_LANDMARK.LEFT_HEEL],
  [POSE_LANDMARK.LEFT_ANKLE, POSE_LANDMARK.LEFT_FOOT_INDEX],
  [POSE_LANDMARK.LEFT_HEEL, POSE_LANDMARK.LEFT_FOOT_INDEX],
  // Right leg + foot
  [POSE_LANDMARK.RIGHT_HIP, POSE_LANDMARK.RIGHT_KNEE],
  [POSE_LANDMARK.RIGHT_KNEE, POSE_LANDMARK.RIGHT_ANKLE],
  [POSE_LANDMARK.RIGHT_ANKLE, POSE_LANDMARK.RIGHT_HEEL],
  [POSE_LANDMARK.RIGHT_ANKLE, POSE_LANDMARK.RIGHT_FOOT_INDEX],
  [POSE_LANDMARK.RIGHT_HEEL, POSE_LANDMARK.RIGHT_FOOT_INDEX],
]

/** Key joints drawn as dots */
export const JOINT_INDICES = [
  POSE_LANDMARK.NOSE,
  POSE_LANDMARK.LEFT_EAR,
  POSE_LANDMARK.RIGHT_EAR,
  POSE_LANDMARK.LEFT_SHOULDER,
  POSE_LANDMARK.RIGHT_SHOULDER,
  POSE_LANDMARK.LEFT_ELBOW,
  POSE_LANDMARK.RIGHT_ELBOW,
  POSE_LANDMARK.LEFT_WRIST,
  POSE_LANDMARK.RIGHT_WRIST,
  POSE_LANDMARK.LEFT_PINKY,
  POSE_LANDMARK.RIGHT_PINKY,
  POSE_LANDMARK.LEFT_INDEX,
  POSE_LANDMARK.RIGHT_INDEX,
  POSE_LANDMARK.LEFT_HIP,
  POSE_LANDMARK.RIGHT_HIP,
  POSE_LANDMARK.LEFT_KNEE,
  POSE_LANDMARK.RIGHT_KNEE,
  POSE_LANDMARK.LEFT_ANKLE,
  POSE_LANDMARK.RIGHT_ANKLE,
  POSE_LANDMARK.LEFT_HEEL,
  POSE_LANDMARK.RIGHT_HEEL,
  POSE_LANDMARK.LEFT_FOOT_INDEX,
  POSE_LANDMARK.RIGHT_FOOT_INDEX,
] as const

export function getMidpoint(a: NormalizedLandmark, b: NormalizedLandmark): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

export function landmarkToCanvas(
  landmark: NormalizedLandmark,
  width: number,
  height: number,
  mirrored = true,
): Point2D {
  const x = mirrored ? 1 - landmark.x : landmark.x
  return {
    x: x * width,
    y: landmark.y * height,
  }
}

export function euclideanDistance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function averageDisplacement(
  current: NormalizedLandmark[],
  past: NormalizedLandmark[],
): number {
  if (current.length === 0 || past.length === 0) return 0

  let total = 0
  let count = 0

  for (const idx of TRACKED_LANDMARKS) {
    const c = current[idx]
    const p = past[idx]
    if (!c || !p) continue
    if ((c.visibility ?? 1) < 0.3 || (p.visibility ?? 1) < 0.3) continue
    total += euclideanDistance({ x: c.x, y: c.y }, { x: p.x, y: p.y })
    count++
  }

  return count > 0 ? total / count : 0
}

export function getTorsoMidpoints(landmarks: NormalizedLandmark[]): {
  shoulderMid: Point2D
  hipMid: Point2D
} | null {
  const ls = landmarks[POSE_LANDMARK.LEFT_SHOULDER]
  const rs = landmarks[POSE_LANDMARK.RIGHT_SHOULDER]
  const lh = landmarks[POSE_LANDMARK.LEFT_HIP]
  const rh = landmarks[POSE_LANDMARK.RIGHT_HIP]

  if (!ls || !rs || !lh || !rh) return null

  return {
    shoulderMid: getMidpoint(ls, rs),
    hipMid: getMidpoint(lh, rh),
  }
}

export function isLandmarkVisible(
  landmark: NormalizedLandmark | undefined,
  threshold = 0.5,
): boolean {
  return !!landmark && (landmark.visibility ?? 1) >= threshold
}
