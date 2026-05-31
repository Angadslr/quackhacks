import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../components/SkeletonCanvas'
import type { PersonDetection } from '../types/detection'
import { normalizeBBox } from '../types/detection'
import { WASM_CDN } from '../types/pose'

const MAX_DETECTIONS = 5
const OBJECT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'

interface UsePersonDetectionOptions {
  isMonitoring: boolean
  isReady: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  useVideoTimestamp: boolean
  onDetections: (detections: PersonDetection[], timestamp: number) => void
}

interface UsePersonDetectionResult {
  fps: number
  isLoading: boolean
  error: string | null
  personCount: number
}

export function usePersonDetection({
  isMonitoring,
  isReady,
  videoRef,
  useVideoTimestamp,
  onDetections,
}: UsePersonDetectionOptions): UsePersonDetectionResult {
  const detectorRef = useRef<ObjectDetector | null>(null)
  const rafRef = useRef<number>(0)
  const lastInferenceRef = useRef(0)
  const frameTimesRef = useRef<number[]>([])
  const onDetectionsRef = useRef(onDetections)
  const timeOffsetRef = useRef(0)
  const lastVideoTimeRef = useRef(0)

  const [fps, setFps] = useState(0)
  const [personCount, setPersonCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onDetectionsRef.current = onDetections

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

  const initDetector = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN)

      const createWithDelegate = async (delegate: 'GPU' | 'CPU') =>
        ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: OBJECT_MODEL_URL,
            delegate,
          },
          runningMode: 'VIDEO',
          maxResults: MAX_DETECTIONS,
          scoreThreshold: 0.25,
          categoryAllowlist: ['person'],
        })

      try {
        detectorRef.current = await createWithDelegate('GPU')
      } catch {
        detectorRef.current = await createWithDelegate('CPU')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load person detection model',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMonitoring && !detectorRef.current && !isLoading) {
      void initDetector()
    }
  }, [isMonitoring, isLoading, initDetector])

  useEffect(() => {
    if (!isMonitoring) {
      timeOffsetRef.current = 0
      lastVideoTimeRef.current = 0
    }
  }, [isMonitoring])

  useEffect(() => {
    if (!isMonitoring || !isReady) {
      cancelAnimationFrame(rafRef.current)
      setPersonCount(0)
      return
    }

    const loop = (timestamp: number) => {
      const video = videoRef.current
      const detector = detectorRef.current

      if (video && detector && video.readyState >= 2 && !video.paused) {
        if (timestamp - lastInferenceRef.current >= 33) {
          lastInferenceRef.current = timestamp

          try {
            const detectionTs = getDetectionTimestamp(video, timestamp)
            const result = detector.detectForVideo(video, detectionTs)
            const frameW = video.videoWidth || CANVAS_WIDTH
            const frameH = video.videoHeight || CANVAS_HEIGHT

            const detections: PersonDetection[] = (result.detections ?? [])
              .filter((d) => d.boundingBox && d.categories.some((c) => c.categoryName === 'person'))
              .map((d) => ({
                bbox: normalizeBBox(d.boundingBox!, frameW, frameH),
                confidence: d.categories.find((c) => c.categoryName === 'person')?.score ?? 0,
              }))

            setPersonCount(detections.length)
            onDetectionsRef.current(detections, detectionTs)

            frameTimesRef.current.push(timestamp)
            const oneSecondAgo = timestamp - 1000
            frameTimesRef.current = frameTimesRef.current.filter(
              (t) => t > oneSecondAgo,
            )
            setFps(frameTimesRef.current.length)
          } catch {
            setPersonCount(0)
            onDetectionsRef.current([], timestamp)
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
      detectorRef.current?.close()
      detectorRef.current = null
    }
  }, [])

  return { fps, isLoading, error, personCount }
}
