export type Effect = 'tick' | 'ok' | 'wrong' | 'bell' | 'engine' | 'delivered' | 'fetch'

let context: AudioContext | null = null

export function soundEnabled(): boolean {
  return localStorage.getItem('bdi-mute') !== '1'
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem('bdi-mute', on ? '0' : '1')
}

export function unlockAudio() {
  if (!context) context = new AudioContext()
  if (context.state === 'suspended') void context.resume()
}

function volume(): number {
  return Math.max(0, Math.min(1, Number(localStorage.getItem('bdi-volume') ?? 0.4)))
}

function tone(freq: number, start: number, length: number, type: OscillatorType = 'sine', gain = 1, slideTo?: number) {
  if (!context) return
  const osc = context.createOscillator()
  const amp = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume() * 0.35 * gain), start + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(amp).connect(context.destination)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

export function play(effect: Effect) {
  if (!context || !soundEnabled() || context.state !== 'running') return
  const t = context.currentTime
  if (effect === 'tick') tone(880, t, 0.08, 'triangle', 0.6)
  if (effect === 'ok') { tone(660, t, 0.12, 'triangle'); tone(990, t + 0.1, 0.2, 'triangle') }
  if (effect === 'wrong') { tone(220, t, 0.18, 'square', 0.5); tone(180, t + 0.16, 0.24, 'square', 0.5) }
  if (effect === 'bell') { tone(1320, t, 0.5, 'sine', 0.8); tone(1980, t, 0.35, 'sine', 0.3) }
  if (effect === 'fetch') { tone(520, t, 0.12, 'sine', 0.6, 780); tone(780, t + 0.14, 0.12, 'sine', 0.6, 520) }
  if (effect === 'engine') tone(70, t, 0.9, 'sawtooth', 0.25, 110)
  if (effect === 'delivered') [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'triangle', 0.9))
}
