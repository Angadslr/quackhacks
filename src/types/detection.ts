/** Bounding box with normalized 0–1 coordinates relative to frame size. */
export interface NormalizedBBox {
  originX: number
  originY: number
  width: number
  height: number
}

export interface PersonDetection {
  bbox: NormalizedBBox
  confidence: number
}

export function bboxCenter(bbox: NormalizedBBox): { x: number; y: number } {
  return {
    x: bbox.originX + bbox.width / 2,
    y: bbox.originY + bbox.height / 2,
  }
}

export function bboxArea(bbox: NormalizedBBox): number {
  return Math.max(bbox.width, 0) * Math.max(bbox.height, 0)
}

export function normalizeBBox(
  bbox: { originX: number; originY: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number,
): NormalizedBBox {
  return {
    originX: bbox.originX / frameWidth,
    originY: bbox.originY / frameHeight,
    width: bbox.width / frameWidth,
    height: bbox.height / frameHeight,
  }
}
