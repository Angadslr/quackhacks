import type { NormalizedLandmark } from '../types/pose'
import { getTorsoMidpoints } from './poseMath'

interface TrackedSlot {
  id: number
  lastHip: { x: number; y: number }
  lastSeen: number
}

// Normal inter-frame matching: person must be within ~20% of frame width
const MATCH_THRESHOLD_SQ = 0.04

// Ghost re-association: person resurfaces within ~40% of frame width from their last position.
// Wide enough to handle a few metres of underwater drift; tight enough not to steal another
// person's slot in a crowded pool.
const GHOST_MATCH_THRESHOLD_SQ = 0.16

// Slot is "fresh" (tight matching) if seen within this window
const FRESH_MS = 2_000

// Keep stale slots alive for the full ghost tracking window so re-association can happen
const STALE_MS = 20_000

export class PersonTracker {
  private slots: TrackedSlot[] = []
  private nextId = 1

  assignIds(poses: NormalizedLandmark[][], timestamp: number): number[] {
    const usedSlots = new Set<number>()
    const ids: number[] = []

    for (const landmarks of poses) {
      const mid = getTorsoMidpoints(landmarks)
      const hip = mid?.hipMid ?? { x: 0.5, y: 0.5 }

      let bestIdx = -1
      let bestDist = Infinity

      for (let i = 0; i < this.slots.length; i++) {
        if (usedSlots.has(i)) continue
        const slot = this.slots[i]
        if (timestamp - slot.lastSeen > STALE_MS) continue

        const dx = hip.x - slot.lastHip.x
        const dy = hip.y - slot.lastHip.y
        const dist = dx * dx + dy * dy
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }

      // Use a tight threshold for recently-seen persons and a wide threshold for ghost
      // candidates (missing > FRESH_MS). This lets a submerged person resurface anywhere
      // in the pool and still get matched back to their original ID.
      const matched = bestIdx >= 0 && (() => {
        const missingMs = timestamp - this.slots[bestIdx].lastSeen
        const threshold = missingMs > FRESH_MS ? GHOST_MATCH_THRESHOLD_SQ : MATCH_THRESHOLD_SQ
        return bestDist < threshold
      })()

      if (matched) {
        usedSlots.add(bestIdx)
        this.slots[bestIdx].lastHip = hip
        this.slots[bestIdx].lastSeen = timestamp
        ids.push(this.slots[bestIdx].id)
      } else {
        const id = this.nextId++
        this.slots.push({ id, lastHip: hip, lastSeen: timestamp })
        ids.push(id)
      }
    }

    // Prune only fully expired slots
    this.slots = this.slots.filter((s) => timestamp - s.lastSeen <= STALE_MS)

    return ids
  }

  reset(): void {
    this.slots = []
    this.nextId = 1
  }
}
