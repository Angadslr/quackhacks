import type { SignalBreakdown } from './risk'

export interface NormalizedLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export const MAX_POSES = 5

export interface PersonFrame {
  landmarks: NormalizedLandmark[]
  riskScore: number
}

export interface PoseFrame {
  timestamp: number
  people: PersonFrame[]
  riskScore: number
}

export interface Incident {
  id: string
  startTime: number
  peakRisk: number
  durationMs: number
  frames: PoseFrame[]
  contributors: SignalBreakdown
  personId?: number
}

/** YOLOv8 Pose / COCO 17-landmark indices */
export const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const

export const WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'

export const MODEL_URL =
  'https://huggingface.co/Xenova/yolov8n-pose/resolve/main/onnx/model.onnx'
