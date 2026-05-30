import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { MAX_POSES, MODEL_URL, WASM_CDN } from '../types/pose'

interface UsePoseDetectionOptions {
  isMonitoring: boolean
  isReady: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  useVideoTimestamp: boolean
  onPoses: (poses: NormalizedLandmark[][], timestamp: number) => void
}

interface UsePoseDetectionResult {
  fps: number
  isLoading: boolean
  error: string | null
  poseCount: number
}

export function usePoseDetection({
  isMonitoring,
  isReady,
  videoRef,
  useVideoTimestamp,
  onPoses,
}: UsePoseDetectionOptions): UsePoseDetectionResult {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const lastInferenceRef = useRef(0)
  const frameTimesRef = useRef<number[]>([])
  const onPosesRef = useRef(onPoses)
  const timeOffsetRef = useRef(0)
  const lastVideoTimeRef = useRef(0)

  const [fps, setFps] = useState(0)
  const [poseCount, setPoseCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onPosesRef.current = onPoses

  const getDetectionTimestamp = useCallback(
    (video: HTMLVideoElement, rafTime: number): number => {
      if (!useVideoTimestamp) return rafTime

      const current = video.currentTime
      if (current < lastVideoTimeRef.current - 0.05) {
        timeOffsetRef.current += lastVideoTimeRef.current * 1000
      }
      lastVideoTimeRef.current = current
      return timeOffsetRef.current + current * 1000
    },
    [useVideoTimestamp],
  )

  const initLandmarker = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN)

      const createWithDelegate = async (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: 'VIDEO',
          numPoses: MAX_POSES,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

      try {
        landmarkerRef.current = await createWithDelegate('GPU')
      } catch {
        landmarkerRef.current = await createWithDelegate('CPU')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load pose detection model',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMonitoring && !landmarkerRef.current && !isLoading) {
      void initLandmarker()
    }
  }, [isMonitoring, isLoading, initLandmarker])

  useEffect(() => {
    if (!isMonitoring) {
      timeOffsetRef.current = 0
      lastVideoTimeRef.current = 0
    }
  }, [isMonitoring])

  useEffect(() => {
    if (!isMonitoring || !isReady) {
      cancelAnimationFrame(rafRef.current)
      setPoseCount(0)
      return
    }

    const loop = (timestamp: number) => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current

      if (video && landmarker && video.readyState >= 2 && !video.paused) {
        if (timestamp - lastInferenceRef.current >= 33) {
          lastInferenceRef.current = timestamp

          try {
            const detectionTs = getDetectionTimestamp(video, timestamp)
            const result = landmarker.detectForVideo(video, detectionTs)
            const poses = (result.landmarks ?? []).map((lm) =>
              lm.map((point) => ({ ...point })),
            )
            setPoseCount(poses.length)
            onPosesRef.current(poses, detectionTs)

            frameTimesRef.current.push(timestamp)
            const oneSecondAgo = timestamp - 1000
            frameTimesRef.current = frameTimesRef.current.filter(
              (t) => t > oneSecondAgo,
            )
            setFps(frameTimesRef.current.length)
          } catch {
            setPoseCount(0)
            onPosesRef.current([], timestamp)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [isMonitoring, isReady, videoRef, getDetectionTimestamp])

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  return { fps, isLoading, error, poseCount }
}
