import type { Language } from './types.js'

export interface Ctx {
  now: string
  language: Language
  presentationMs: number
  pipelineMs: number
  animationMs: number
  graceMs: number
  /** Close sessions with no commands/heartbeats for this long (ms). */
  idleMs: number
}
