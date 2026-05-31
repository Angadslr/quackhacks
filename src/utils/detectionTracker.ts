import type { NormalizedBBox, PersonDetection } from '../types/detection'
import { bboxCenter } from '../types/detection'
import {
  CLUSTER_DIST,
  ISOLATION_DIST,
  isInWaterRegion,
  isMergedGroupBox,
  isNearEdge,
  nearestNeighborDistance,
} from './poolPosture'
import type { Zone } from '../types/zone'
import { zoneVerdict } from '../types/zone'

export interface DetectionHistoryEntry {
  timestamp: number
  bbox: NormalizedBBox
  confidence: number
  center: { x: number; y: number }
}

export interface TrackedDetection {
  id: number
  bbox: NormalizedBBox | null
  confidence: number
  center: { x: number; y: number }
  isMissing: boolean
  missingSince: number | null
  lastSeen: number
  nearestNeighborDist: number
  wasLoneSwimmer: boolean
}

interface TrackedSlot {
  id: number
  lastCenter: { x: number; y: number }
  lastBBox: NormalizedBBox
  lastConfidence: number
  lastSeen: number
  lastNeighborDist: number
  wasLoneSwimmer: boolean
  missingSince: number | null
}

const MATCH_THRESHOLD_SQ = 0.04
const STALE_MS = 8000
const GHOST_GRACE_MS = 500

export class DetectionTracker {
  private slots: TrackedSlot[] = []
  private nextId = 1

  assignAndTrack(
    detections: PersonDetection[],
    timestamp: number,
    zones: Zone[] = [],
  ): TrackedDetection[] {
    const usedSlots = new Set<number>()
    const active: TrackedDetection[] = []

    const centers = detections.map((d) => bboxCenter(d.bbox))

    for (let d = 0; d < detections.length; d++) {
      const detection = detections[d]
      const center = centers[d]
      const others = centers.filter((_, j) => j !== d)
      const nnDist = nearestNeighborDistance(center, others)
      const isolatedInWater =
        nnDist > ISOLATION_DIST &&
        isInWaterRegion(center) &&
        !isNearEdge(center) &&
        !isMergedGroupBox(detection.bbox)

      let bestIdx = -1
      let bestDist = Infinity

      for (let i = 0; i < this.slots.length; i++) {
        if (usedSlots.has(i)) continue
        const slot = this.slots[i]
        if (timestamp - slot.lastSeen > STALE_MS && slot.missingSince === null)
          continue

        const dx = center.x - slot.lastCenter.x
        const dy = center.y - slot.lastCenter.y
        const dist = dx * dx + dy * dy
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }

      if (bestIdx >= 0 && bestDist < MATCH_THRESHOLD_SQ) {
        usedSlots.add(bestIdx)
        const slot = this.slots[bestIdx]
        slot.lastCenter = center
        slot.lastBBox = detection.bbox
        slot.lastConfidence = detection.confidence
        slot.lastSeen = timestamp
        slot.lastNeighborDist = nnDist
        slot.missingSince = null
        if (isolatedInWater) slot.wasLoneSwimmer = true

        active.push({
          id: slot.id,
          bbox: detection.bbox,
          confidence: detection.confidence,
          center,
          isMissing: false,
          missingSince: null,
          lastSeen: timestamp,
          nearestNeighborDist: nnDist,
          wasLoneSwimmer: slot.wasLoneSwimmer,
        })
      } else {
        const id = this.nextId++
        this.slots.push({
          id,
          lastCenter: center,
          lastBBox: detection.bbox,
          lastConfidence: detection.confidence,
          lastSeen: timestamp,
          lastNeighborDist: nnDist,
          wasLoneSwimmer: isolatedInWater,
          missingSince: null,
        })
        active.push({
          id,
          bbox: detection.bbox,
          confidence: detection.confidence,
          center,
          isMissing: false,
          missingSince: null,
          lastSeen: timestamp,
          nearestNeighborDist: nnDist,
          wasLoneSwimmer: isolatedInWater,
        })
      }
    }

    const ghosts: TrackedDetection[] = []
    for (let i = 0; i < this.slots.length; i++) {
      if (usedSlots.has(i)) continue
      const slot = this.slots[i]

      if (slot.missingSince === null) {
        slot.missingSince = timestamp
      }

      const missingDuration = timestamp - (slot.missingSince ?? timestamp)
      if (missingDuration < GHOST_GRACE_MS) continue
      if (timestamp - slot.lastSeen > STALE_MS) continue

      const verdict = zoneVerdict(zones, slot.lastCenter)
      if (verdict === 'safe') continue
      if (verdict === 'auto') {
        if (!slot.wasLoneSwimmer) continue
        if (slot.lastNeighborDist < CLUSTER_DIST) continue
        if (!isInWaterRegion(slot.lastCenter) || isNearEdge(slot.lastCenter)) continue
      }

      ghosts.push({
        id: slot.id,
        bbox: null,
        confidence: 0,
        center: slot.lastCenter,
        isMissing: true,
        missingSince: slot.missingSince,
        lastSeen: slot.lastSeen,
        nearestNeighborDist: slot.lastNeighborDist,
        wasLoneSwimmer: slot.wasLoneSwimmer,
      })
    }

    this.slots = this.slots.filter((s) => {
      if (s.missingSince !== null) return timestamp - s.missingSince <= STALE_MS
      return timestamp - s.lastSeen <= STALE_MS
    })

    return [...active, ...ghosts]
  }

  reset(): void {
    this.slots = []
    this.nextId = 1
  }
}
