import { SkeletonCanvas } from './SkeletonCanvas'
import type { TrackedPerson } from '../types/person'
import type { VideoSourceMode } from '../types/videoSource'
import type { Zone, ZoneKind } from '../types/zone'

interface VideoFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  activePeople: TrackedPerson[]
  rosterCount: number
  isMonitoring: boolean
  mirrored: boolean
  sourceMode: VideoSourceMode
  isReady: boolean
  fileName: string | null
  videoDuration: number
  videoCurrentTime: number
  zones: Zone[]
  zoneEditing: boolean
  zoneDrawKind: ZoneKind
  onZoneCreate: (zone: Omit<Zone, 'id'>) => void
  onZoneRemove: (id: string) => void
}

export function VideoFeed({
  videoRef,
  activePeople,
  rosterCount,
  isMonitoring,
  mirrored,
  sourceMode,
  isReady,
  fileName,
  videoDuration,
  videoCurrentTime,
  zones,
  zoneEditing,
  zoneDrawKind,
  onZoneCreate,
  onZoneRemove,
}: VideoFeedProps) {
  return (
    <SkeletonCanvas
      videoRef={videoRef}
      people={activePeople}
      rosterCount={rosterCount}
      isMonitoring={isMonitoring}
      mirrored={mirrored}
      sourceMode={sourceMode}
      isReady={isReady}
      fileName={fileName}
      videoDuration={videoDuration}
      videoCurrentTime={videoCurrentTime}
      zones={zones}
      zoneEditing={zoneEditing}
      zoneDrawKind={zoneDrawKind}
      onZoneCreate={onZoneCreate}
      onZoneRemove={onZoneRemove}
    />
  )
}
