export type TimelineEventKind = 'system' | 'risk' | 'alert' | 'info' | 'ai'

export interface TimelineEvent {
  id: string
  time: Date
  message: string
  kind: TimelineEventKind
  riskScore?: number
}
