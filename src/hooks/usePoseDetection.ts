import { useCallback, useEffect, useRef, useState } from 'react'
import * as ort from 'onnxruntime-web'
import type { NormalizedLandmark } from '../types/pose'
import { MAX_POSES, MODEL_URL, WASM_CDN } from '../types/pose'

const INPUT_SIZE = 640
const CONF_THRESHOLD = 0.4
const IOU_THRESHOLD = 0.45
const NUM_KEYPOINTS = 17

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

// Preprocess a video frame into a [1, 3, 640, 640] float32 tensor
function preprocessFrame(
  video: HTMLVideoElement,
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
): ort.Tensor {
  ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = imageData

  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  const planeSize = INPUT_SIZE * INPUT_SIZE
  for (let i = 0; i < planeSize; i++) {
    tensor[i] = data[i * 4] / 255             // R
    tensor[planeSize + i] = data[i * 4 + 1] / 255  // G
    tensor[2 * planeSize + i] = data[i * 4 + 2] / 255 // B
  }

  return new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

// YOLOv8 pose output: [1, 56, 8400] — cx, cy, w, h, conf, then 17*(x, y, kp_conf)
function decodeOutput(
  output: ort.Tensor,
  origW: number,
  origH: number,
): NormalizedLandmark[][] {
  const raw = output.data as Float32Array
  const numDets = 8400
  const stride = 5 + NUM_KEYPOINTS * 3

  // Collect detections above confidence threshold
  const boxes: number[][] = []
  const scores: number[] = []
  const keypointsList: number[][] = []

  for (let i = 0; i < numDets; i++) {
    const conf = raw[4 * numDets + i]
    if (conf < CONF_THRESHOLD) continue

    const cx = raw[0 * numDets + i]
    const cy = raw[1 * numDets + i]
    const w = raw[2 * numDets + i]
    const h = raw[3 * numDets + i]

    boxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
    scores.push(conf)

    const kps: number[] = []
    for (let k = 0; k < NUM_KEYPOINTS; k++) {
      const base = (5 + k * 3) * numDets + i
      kps.push(raw[base], raw[base + numDets], raw[base + 2 * numDets])
    }
    keypointsList.push(kps)
  }

  // NMS
  const kept = nms(boxes, scores, IOU_THRESHOLD, MAX_POSES)

  // Scale factors from 640x640 back to original video size
  const scaleX = origW / INPUT_SIZE
  const scaleY = origH / INPUT_SIZE

  return kept.map((idx) => {
    const kps = keypointsList[idx]
    const landmarks: NormalizedLandmark[] = []
    for (let k = 0; k < NUM_KEYPOINTS; k++) {
      const px = (kps[k * 3] * scaleX) / origW
      const py = (kps[k * 3 + 1] * scaleY) / origH
      const vis = kps[k * 3 + 2]
      landmarks.push({ x: px, y: py, z: 0, visibility: vis })
    }
    return landmarks
  })
}

function iou(a: number[], b: number[]): number {
  const ix1 = Math.max(a[0], b[0])
  const iy1 = Math.max(a[1], b[1])
  const ix2 = Math.min(a[2], b[2])
  const iy2 = Math.min(a[3], b[3])
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter + 1e-6)
}

function nms(
  boxes: number[][],
  scores: number[],
  iouThreshold: number,
  maxDets: number,
): number[] {
  const order = scores
    .map((s, i) => [s, i] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i)

  const kept: number[] = []
  const suppressed = new Uint8Array(boxes.length)

  for (const i of order) {
    if (suppressed[i]) continue
    kept.push(i)
    if (kept.length >= maxDets) break
    for (const j of order) {
      if (suppressed[j] || j === i) continue
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed[j] = 1
    }
  }

  return kept
}

export function usePoseDetection({
  isMonitoring,
  isReady,
  videoRef,
  useVideoTimestamp,
  onPoses,
}: UsePoseDetectionOptions): UsePoseDetectionResult {
  const sessionRef = useRef<ort.InferenceSession | null>(null)
  const offscreenRef = useRef<OffscreenCanvas | null>(null)
  const offscreenCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null)
  const rafRef = useRef<number>(0)
  const isInferringRef = useRef(false)
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

  const initSession = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      ort.env.wasm.wasmPaths = WASM_CDN

      sessionRef.current = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['webgpu', 'webgl', 'wasm'],
      })

      offscreenRef.current = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
      offscreenCtxRef.current = offscreenRef.current.getContext('2d')!
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load YOLOv8 pose model',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMonitoring && !sessionRef.current && !isLoading) {
      void initSession()
    }
  }, [isMonitoring, isLoading, initSession])

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
      const session = sessionRef.current
      const canvas = offscreenRef.current
      const ctx = offscreenCtxRef.current

      if (
        video &&
        session &&
        canvas &&
        ctx &&
        video.readyState >= 2 &&
        !video.paused &&
        !isInferringRef.current
      ) {
        const detectionTs = getDetectionTimestamp(video, timestamp)
        isInferringRef.current = true

        const inputTensor = preprocessFrame(video, canvas, ctx)

        session
          .run({ [session.inputNames[0]]: inputTensor })
          .then((results) => {
            const poses = decodeOutput(
              results[session.outputNames[0]],
              video.videoWidth,
              video.videoHeight,
            )
            setPoseCount(poses.length)
            onPosesRef.current(poses, detectionTs)

            const now = performance.now()
            frameTimesRef.current.push(now)
            frameTimesRef.current = frameTimesRef.current.filter(
              (t) => t > now - 1000,
            )
            setFps(frameTimesRef.current.length)
          })
          .catch(() => {
            setPoseCount(0)
            onPosesRef.current([], detectionTs)
          })
          .finally(() => {
            isInferringRef.current = false
          })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isMonitoring, isReady, videoRef, getDetectionTimestamp])

  useEffect(() => {
    return () => {
      void sessionRef.current?.release()
      sessionRef.current = null
    }
  }, [])

  return { fps, isLoading, error, poseCount }
}
