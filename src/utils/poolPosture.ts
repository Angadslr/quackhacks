import type { NormalizedBBox } from '../types/detection'
import { bboxArea } from '../types/detection'

/**
 * This pool camera is a wide oblique view where the whole pool fills the frame,
 * so "depth" can't be read off the y-axis. People stand and socialize in the
 * shallow corner by the steps/ladder (the frame edges), while a swimmer in
 * trouble is alone out in the open center of the pool.
 *
 * Two discriminators are combined so it still works when the detector merges a
 * standing group into a single box:
 *   1. EDGE / CORNER band  → standing area, treated as safe.
 *   2. ISOLATION + box size → a lone, single-person box in open water is the
 *      drowning candidate; large merged boxes (a group) are not.
 */

/** Below this nearest-neighbor distance, people are part of a social cluster. */
export const CLUSTER_DIST = 0.22
/** Above this nearest-neighbor distance, a person counts as isolated. */
export const ISOLATION_DIST = 0.26

/** Frame-edge band where people stand/hang on the pool wall and steps. */
const EDGE_LEFT = 0.34
const EDGE_RIGHT = 0.93
const EDGE_TOP = 0.2
const EDGE_BOTTOM = 0.9

/** A single person's box is small; a merged standing group is much larger. */
const MAX_SINGLE_PERSON_AREA = 0.09

export function pointDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function nearestNeighborDistance(
  center: { x: number; y: number },
  others: { x: number; y: number }[],
): number {
  let min = Infinity
  for (const o of others) {
    const d = pointDistance(center, o)
    if (d < min) min = d
  }
  return min
}

/** Inside the pool water area (excludes the deck border around the frame). */
export function isInWaterRegion(center: { x: number; y: number }): boolean {
  return center.x > 0.12 && center.x < 0.96 && center.y > 0.1 && center.y < 0.99
}

/** In the edge/corner standing band where people congregate by the wall. */
export function isNearEdge(center: { x: number; y: number }): boolean {
  return (
    center.x < EDGE_LEFT ||
    center.x > EDGE_RIGHT ||
    center.y < EDGE_TOP ||
    center.y > EDGE_BOTTOM
  )
}

/** A box too big to be one person — usually several merged standing people. */
export function isMergedGroupBox(bbox: NormalizedBBox): boolean {
  return bboxArea(bbox) > MAX_SINGLE_PERSON_AREA
}

/**
 * A lone single swimmer out in open water — the only situation we score for
 * drowning. Excludes the standing corner, social clusters, and merged groups.
 */
export function isLoneSwimmer(
  bbox: NormalizedBBox,
  center: { x: number; y: number },
  nearestNeighborDist: number,
): boolean {
  if (!isInWaterRegion(center)) return false
  if (isNearEdge(center)) return false
  if (isMergedGroupBox(bbox)) return false
  if (nearestNeighborDist < CLUSTER_DIST) return false
  return true
}

/** Clustered, at the wall, or a merged group box → safe regardless of posture. */
export function isSafeBystander(
  bbox: NormalizedBBox,
  center: { x: number; y: number },
  nearestNeighborDist: number,
): boolean {
  return (
    nearestNeighborDist < CLUSTER_DIST ||
    isNearEdge(center) ||
    isMergedGroupBox(bbox)
  )
}

/** Extreme body proportions (very vertical or very horizontal/prone), 0–1. */
export function postureExtremeness(bbox: NormalizedBBox): number {
  const aspect = bbox.height / Math.max(bbox.width, 0.01)
  if (aspect >= 1.15) return Math.min((aspect - 1.15) / 0.85, 1)
  if (aspect <= 0.85) return Math.min((0.85 - aspect) / 0.55, 1)
  return 0
}
