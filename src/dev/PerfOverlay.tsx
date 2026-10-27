/**
 * Frame-time harness: `?perf` mounts this panel (and nothing else changes).
 *
 * Phase 1 acceptance is stated in frame times, not fps: p95 <= 16.7 ms and no
 * frame > 33 ms (plan §7.7). A display refresh count would inflate the result on
 * a 120 Hz screen, so this measures the interval between *rendered* frames — the
 * thing a stutter actually breaks — and reports percentiles plus the worst frame.
 *
 * The panel is mounted outside `<Canvas>`, where `useFrame` has no store, so it
 * taps R3F's global `addAfterEffect`, which fires once per frame after
 * `gl.render` (the published, typed equivalent of the end of a `useFrame` pass).
 * Deltas come from the rAF timestamp; `performance.now()` deltas are recorded in
 * parallel as a cross-check on frame pacing.
 *
 * Nothing is interactive: the numbers must survive a screenshot. `R` clears the
 * samples and starts a fresh 10 s window (3 s warm-up first).
 */

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

const WARMUP_MS = 3000
const WINDOW_MS = 10_000
/** DOM writes at most 4×/s: the frame loop must never touch React state. */
const PAINT_MS = 250
/** Longer than any real frame: a hidden tab or a suspend, not a stutter. */
const SUSPEND_MS = 1000
const BUDGET_P95_MS = 16.7
const BUDGET_MAX_MS = 33

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: 2147483647,
  padding: '0.45rem 0.6rem',
  pointerEvents: 'none',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  lineHeight: 1.4,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'left',
  whiteSpace: 'pre',
  color: 'var(--color-limewash, #e9edea)',
  background: 'rgba(9, 14, 22, 0.88)',
  borderRight: '1px solid rgba(188, 148, 64, 0.55)',
  borderBottom: '1px solid rgba(188, 148, 64, 0.55)',
  borderRadius: '0 0 4px 0',
}

const TITLE_STYLE: CSSProperties = { color: 'var(--color-brass, #bc9440)' }
const HINT_STYLE: CSSProperties = { marginTop: '0.3rem', opacity: 0.72 }
const TEXT_STYLE: CSSProperties = { margin: '0.15rem 0 0', font: 'inherit' }

interface Peaks {
  calls: number
  triangles: number
  programs: number
}

interface Summary {
  readonly n: number
  readonly avg: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
  readonly over20: number
  readonly over33: number
  readonly crossP95: number
  /** Median warm-up interval: the display's nominal refresh, for context. */
  readonly refresh: number
  readonly suspended: number
  readonly peaks: Peaks
}

interface Recorder {
  startedAt: number | null
  lastStamp: number
  lastNow: number
  lastPaint: number
  /** rAF-timestamp deltas inside the measured window. */
  frames: number[]
  /** `performance.now()` deltas, same frames, cross-check only. */
  nows: number[]
  /** First ~4 s of deltas (before the window), used for the refresh estimate. */
  warmDeltas: number[]
  suspended: number
  peaks: Peaks
  summary: Summary | null
}

type Fiber = typeof import('@react-three/fiber')

function isPerfEnabled(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf')
}

function createRecorder(): Recorder {
  return {
    startedAt: null,
    lastStamp: 0,
    lastNow: 0,
    lastPaint: 0,
    frames: [],
    nows: [],
    warmDeltas: [],
    suspended: 0,
    peaks: { calls: 0, triangles: 0, programs: 0 },
    summary: null,
  }
}

function resetRecorder(recorder: Recorder): void {
  recorder.startedAt = null
  recorder.frames.length = 0
  recorder.nows.length = 0
  recorder.warmDeltas.length = 0
  recorder.suspended = 0
  recorder.peaks = { calls: 0, triangles: 0, programs: 0 }
  recorder.summary = null
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index]
}

function median(values: readonly number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5)
}

function summarize(recorder: Recorder): Summary {
  const frames = [...recorder.frames].sort((a, b) => a - b)
  let total = 0
  let max = 0
  let over20 = 0
  let over33 = 0
  for (const frame of frames) {
    total += frame
    if (frame > max) max = frame
    if (frame > 20) over20 += 1
    if (frame > BUDGET_MAX_MS) over33 += 1
  }
  const n = frames.length
  return {
    n,
    avg: n === 0 ? 0 : total / n,
    p50: percentile(frames, 0.5),
    p95: percentile(frames, 0.95),
    p99: percentile(frames, 0.99),
    max,
    over20,
    over33,
    crossP95: percentile([...recorder.nows].sort((a, b) => a - b), 0.95),
    refresh: median(recorder.warmDeltas),
    suspended: recorder.suspended,
    peaks: recorder.peaks,
  }
}

const ms = (value: number): string => value.toFixed(1)

function report(summary: Summary): string {
  const pass = summary.p95 <= BUDGET_P95_MS && summary.over33 === 0
  return [
    `n ${summary.n}  refresh~${ms(summary.refresh)}ms`,
    `p50 ${ms(summary.p50)}  p95 ${ms(summary.p95)}`,
    `p99 ${ms(summary.p99)}  max ${ms(summary.max)}`,
    `avg ${ms(summary.avg)}`,
    `>20ms ${summary.over20}  >33ms ${summary.over33}`,
    `xchk p95 ${ms(summary.crossP95)}`,
    `calls ${summary.peaks.calls}  tris ${summary.peaks.triangles}`,
    `progs ${summary.peaks.programs}  susp ${summary.suspended}`,
    `BUDGET ${pass ? 'PASS' : 'FAIL'}`,
  ].join('\n')
}

export function PerfOverlay() {
  const textRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const text = textRef.current
    if (text === null) return

    const recorder = createRecorder()
    let fiber: Fiber | null = null
    let stopped = false
    let stopFrame: (() => void) | null = null

    // Read the just-rendered frame's counts at most 4×/s. `info.autoReset`
    // clears them each render, so these are per-frame numbers, not totals.
    const samplePeaks = (): void => {
      if (fiber === null) return
      const root = fiber._roots.values().next()
      if (root.done) return
      const info = root.value.store.getState().gl.info
      const peaks = recorder.peaks
      peaks.calls = Math.max(peaks.calls, info.render.calls)
      peaks.triangles = Math.max(peaks.triangles, info.render.triangles)
      peaks.programs = Math.max(peaks.programs, info.programs?.length ?? 0)
    }

    const write = (value: string): void => {
      text.textContent = value
    }

    const onFrame = (timestamp: number): void => {
      const now = performance.now()

      if (recorder.startedAt === null) {
        recorder.startedAt = timestamp
        recorder.lastStamp = timestamp
        recorder.lastNow = now
        recorder.lastPaint = now
        write('warming up 0.0 / 3.0 s')
        return
      }

      const stampDelta = timestamp - recorder.lastStamp
      const nowDelta = now - recorder.lastNow
      recorder.lastStamp = timestamp
      recorder.lastNow = now

      // Not a frame: the tab was hidden or the loop was suspended. Drop it and
      // push the window start forward so the report still covers 10 s of frames.
      if (stampDelta > SUSPEND_MS) {
        recorder.suspended += 1
        if (recorder.startedAt !== null) recorder.startedAt += stampDelta
        return
      }

      const elapsed = timestamp - recorder.startedAt

      if (elapsed < WARMUP_MS) {
        if (recorder.warmDeltas.length < 240) recorder.warmDeltas.push(stampDelta)
        if (now - recorder.lastPaint >= PAINT_MS) {
          recorder.lastPaint = now
          write(`warming up ${(elapsed / 1000).toFixed(1)} / 3.0 s`)
        }
        return
      }

      if (elapsed < WARMUP_MS + WINDOW_MS) {
        recorder.frames.push(stampDelta)
        recorder.nows.push(nowDelta)
        if (now - recorder.lastPaint >= PAINT_MS) {
          recorder.lastPaint = now
          samplePeaks()
          write(`recording ${(elapsed / 1000).toFixed(1)} / 10.0 s\nn ${recorder.frames.length}`)
        }
        return
      }

      if (recorder.summary === null) {
        samplePeaks()
        recorder.summary = summarize(recorder)
        write(report(recorder.summary))
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() !== 'r') return

      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return
        if (target.closest('[role="button"]') !== null) return
      }

      resetRecorder(recorder)
      write('restarting…')
    }

    window.addEventListener('keydown', onKeyDown)

    // Only `?perf` pays for R3F here; the scene chunk owns the same modules, so
    // this resolves to what `<Canvas>` already loaded rather than a second copy.
    void import('@react-three/fiber')
      .then((module) => {
        if (stopped) return
        fiber = module
        stopFrame = module.addAfterEffect(onFrame)
      })
      .catch(() => {
        if (!stopped) write('frame hook unavailable')
      })

    return () => {
      stopped = true
      window.removeEventListener('keydown', onKeyDown)
      stopFrame?.()
    }
  }, [])

  return (
    <div style={PANEL_STYLE} aria-hidden="true" id="perf-overlay">
      <div style={TITLE_STYLE}>THE LOGBOOK · FRAME TIME</div>
      <pre ref={textRef} style={TEXT_STYLE} />
      <div style={HINT_STYLE}>
        {'budget p95<=16.7ms, 0 frames>33ms\nR restart  3s warm-up  10s window'}
      </div>
    </div>
  )
}

export { isPerfEnabled }
