import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  isLandmarkVisible,
  JOINT_INDICES,
  landmarkToCanvas,
  SKELETON_CONNECTIONS,
} from './poseMath'
import type { TrackedPerson } from '../types/person'
import { getSkeletonColor } from '../types/risk'

const VISIBILITY_THRESHOLD = 0.5

export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirrored = true,
): void {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  if (mirrored) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, width, height)
  } else {
    ctx.drawImage(video, 0, 0, width, height)
  }
  ctx.restore()
}

export function drawSkeletonOnlyBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  color: string,
  width: number,
  height: number,
  options: { mirrored?: boolean; lineWidth?: number; jointRadius?: number } = {},
): void {
  const { mirrored = true, lineWidth = 3, jointRadius = 5 } = options

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const [a, b] of SKELETON_CONNECTIONS) {
    const la = landmarks[a]
    const lb = landmarks[b]
    if (!isLandmarkVisible(la, VISIBILITY_THRESHOLD)) continue
    if (!isLandmarkVisible(lb, VISIBILITY_THRESHOLD)) continue

    const pa = landmarkToCanvas(la!, width, height, mirrored)
    const pb = landmarkToCanvas(lb!, width, height, mirrored)

    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  ctx.fillStyle = color
  for (const idx of JOINT_INDICES) {
    const lm = landmarks[idx]
    if (!isLandmarkVisible(lm, VISIBILITY_THRESHOLD)) continue
    const p = landmarkToCanvas(lm!, width, height, mirrored)
    ctx.beginPath()
    ctx.arc(p.x, p.y, jointRadius, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawMultipleSkeletons(
  ctx: CanvasRenderingContext2D,
  people: TrackedPerson[],
  width: number,
  height: number,
  mirrored = true,
): void {
  for (const person of people) {
    const color = getSkeletonColor(person.riskState)
    drawSkeleton(ctx, person.landmarks, color, width, height, { mirrored })
  }
}

export function drawSceneWithVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  people: TrackedPerson[],
  width: number,
  height: number,
  mirrored = true,
): void {
  if (video && video.readyState >= 2) {
    drawVideoFrame(ctx, video, width, height, mirrored)
  } else {
    drawSkeletonOnlyBackground(ctx, width, height)
  }

  if (people.length > 0) {
    drawMultipleSkeletons(ctx, people, width, height, mirrored)
  }
}

/** @deprecated use drawSceneWithVideo */
export function drawSkeletonWithVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  landmarks: NormalizedLandmark[] | null,
  color: string,
  width: number,
  height: number,
): void {
  if (video && video.readyState >= 2) {
    drawVideoFrame(ctx, video, width, height)
  } else {
    drawSkeletonOnlyBackground(ctx, width, height)
  }

  if (landmarks) {
    drawSkeleton(ctx, landmarks, color, width, height)
  }
}

export function drawReplayFrame(
  ctx: CanvasRenderingContext2D,
  people: { landmarks: NormalizedLandmark[]; riskScore: number }[],
  width: number,
  height: number,
): void {
  drawSkeletonOnlyBackground(ctx, width, height)
  for (const person of people) {
    const color = getSkeletonColor(
      person.riskScore >= 85
        ? 'CRITICAL'
        : person.riskScore >= 65
          ? 'DISTRESS'
          : person.riskScore >= 40
            ? 'CAUTION'
            : 'SAFE',
    )
    drawSkeleton(ctx, person.landmarks, color, width, height)
  }
}
