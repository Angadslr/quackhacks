import type { NormalizedLandmark } from '../types/pose'
import {
  isLandmarkVisible,
  JOINT_INDICES,
  landmarkToCanvas,
  SKELETON_CONNECTIONS,
} from './poseMath'
import type { TrackedPerson } from '../types/person'
import { getSkeletonColor, getRiskState } from '../types/risk'

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

/** Draw a ghost skeleton: dashed strokes, reduced opacity, "SUBMERGED" label. */
function drawGhostSkeleton(
  ctx: CanvasRenderingContext2D,
  person: TrackedPerson,
  width: number,
  height: number,
  mirrored: boolean,
): void {
  const baseColor = getSkeletonColor(person.riskState)
  // Parse the hex colour and rebuild with reduced alpha
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.setLineDash([6, 5])
  drawSkeleton(ctx, person.landmarks, baseColor, width, height, {
    mirrored,
    lineWidth: 2,
    jointRadius: 4,
  })
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // Compute centroid from visible landmarks
  const visiblePts = person.landmarks
    .filter((lm) => lm && (lm.visibility ?? 1) > 0.25)
    .map((lm) => landmarkToCanvas(lm, width, height, mirrored))

  if (visiblePts.length > 0) {
    const cx = visiblePts.reduce((s, p) => s + p.x, 0) / visiblePts.length
    const cy = visiblePts.reduce((s, p) => s + p.y, 0) / visiblePts.length

    const missingS = person.missingMs != null ? (person.missingMs / 1000).toFixed(1) : '?'
    const label = `SUBMERGED  ${missingS}s`

    ctx.font = 'bold 11px monospace'
    const tw = ctx.measureText(label).width
    const bx = cx - tw / 2 - 5, by = cy - 28
    const bw = tw + 10, bh = 18

    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 4)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cx, by + bh / 2)

    // Pulsing ring at centroid
    const pulse = (Date.now() % 1000) / 1000
    ctx.beginPath()
    ctx.arc(cx, cy, 14 + pulse * 10, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.8 - pulse * 0.7})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.restore()
}

export function drawMultipleSkeletons(
  ctx: CanvasRenderingContext2D,
  people: TrackedPerson[],
  width: number,
  height: number,
  mirrored = true,
): void {
  for (const person of people) {
    if (person.isGhost) {
      drawGhostSkeleton(ctx, person, width, height, mirrored)
    } else {
      const color = getSkeletonColor(person.riskState)
      drawSkeleton(ctx, person.landmarks, color, width, height, { mirrored })
    }
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
    const color = getSkeletonColor(getRiskState(person.riskScore))
    drawSkeleton(ctx, person.landmarks, color, width, height)
  }
}
