import type { NormalizedBBox } from '../types/detection'
import type { TrackedPerson } from '../types/person'
import { getSkeletonColor } from '../types/risk'

function bboxToCanvas(
  bbox: NormalizedBBox,
  width: number,
  height: number,
  mirrored: boolean,
): { x: number; y: number; w: number; h: number } {
  const x = bbox.originX * width
  const y = bbox.originY * height
  const w = bbox.width * width
  const h = bbox.height * height

  if (!mirrored) return { x, y, w, h }

  return {
    x: width - x - w,
    y,
    w,
    h,
  }
}

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

export function drawDetectionBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#1a0b10'
  ctx.fillRect(0, 0, width, height)
}

export function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  bbox: NormalizedBBox,
  color: string,
  width: number,
  height: number,
  options: {
    mirrored?: boolean
    dashed?: boolean
    label?: string
    lineWidth?: number
  } = {},
): void {
  const { mirrored = true, dashed = false, label, lineWidth = 3 } = options
  const rect = bboxToCanvas(bbox, width, height, mirrored)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (dashed) ctx.setLineDash([8, 6])
  else ctx.setLineDash([])

  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.setLineDash([])

  if (label) {
    ctx.fillStyle = color
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(label, rect.x + 4, rect.y - 6 > 12 ? rect.y - 6 : rect.y + 14)
  }
}

export function drawMissingMarker(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  color: string,
  width: number,
  height: number,
  mirrored = true,
): void {
  const x = mirrored ? width - center.x * width : center.x * width
  const y = center.y * height

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])

  ctx.beginPath()
  ctx.arc(x, y, 18, 0, Math.PI * 2)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.fillStyle = color
  ctx.font = 'bold 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('?', x, y + 4)
  ctx.textAlign = 'start'
}

export function drawMultipleDetections(
  ctx: CanvasRenderingContext2D,
  people: TrackedPerson[],
  width: number,
  height: number,
  mirrored = true,
): void {
  for (const person of people) {
    const color = getSkeletonColor(person.riskState)

    if (person.isMissing || !person.bbox) {
      drawMissingMarker(ctx, person.center, color, width, height, mirrored)
      drawBoundingBox(
        ctx,
        {
          originX: person.center.x - 0.06,
          originY: person.center.y - 0.1,
          width: 0.12,
          height: 0.2,
        },
        color,
        width,
        height,
        { mirrored, dashed: true, label: `#${person.id} submerged` },
      )
      continue
    }

    drawBoundingBox(ctx, person.bbox, color, width, height, {
      mirrored,
      label: `#${person.id}`,
    })
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
    drawDetectionBackground(ctx, width, height)
  }

  if (people.length > 0) {
    drawMultipleDetections(ctx, people, width, height, mirrored)
  }
}

export function drawReplayFrame(
  ctx: CanvasRenderingContext2D,
  people: {
    bbox: NormalizedBBox | null
    center: { x: number; y: number }
    isMissing: boolean
    riskScore: number
  }[],
  width: number,
  height: number,
): void {
  drawDetectionBackground(ctx, width, height)

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

    if (person.isMissing || !person.bbox) {
      drawMissingMarker(ctx, person.center, color, width, height, true)
      continue
    }

    drawBoundingBox(ctx, person.bbox, color, width, height, { mirrored: true })
  }
}

/** @deprecated use drawSceneWithVideo */
export function drawSkeletonWithVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  _landmarks: unknown,
  _color: string,
  width: number,
  height: number,
): void {
  if (video && video.readyState >= 2) {
    drawVideoFrame(ctx, video, width, height)
  } else {
    drawDetectionBackground(ctx, width, height)
  }
}

/** @deprecated use drawMultipleDetections */
export function drawMultipleSkeletons(
  ctx: CanvasRenderingContext2D,
  people: TrackedPerson[],
  width: number,
  height: number,
  mirrored = true,
): void {
  drawMultipleDetections(ctx, people, width, height, mirrored)
}

/** @deprecated use drawDetectionBackground */
export function drawSkeletonOnlyBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  drawDetectionBackground(ctx, width, height)
}
