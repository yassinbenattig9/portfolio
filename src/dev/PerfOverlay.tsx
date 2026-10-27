/**
 * Frame-time harness: `?perf` mounts this panel (and nothing else changes).
 *
 * There is no renderer to ask any more: the book is DOM and CSS, so the panel
 * measures the document itself. Frame intervals come from
 * `requestAnimationFrame` timestamps, with `performance.now()` deltas recorded
 * on the same frames as a cross-check on pacing. Long tasks and layout shifts
 * come from `PerformanceObserver`; when a browser does not support an entry
 * type the panel says `n/a` instead of pretending the metric passed.
 *
 * The pass bar for a turn is: no long task > 50 ms, CLS < 0.02, zero frames
 * > 33 ms. All three are shown as their own line, and the headline verdict only
 * says PASS when all three were actually measured.
 *
 * Nothing is interactive: the numbers must survive a screenshot. `R` clears
 * everything and starts a fresh 10 s window after a 3 s warm-up. DOM writes are
 * capped at 4×/s through a ref; no frame ever touches React state.
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
const BUDGET_OVER20_MS = 20
const BUDGET_LONG_TASK_MS = 50
const BUDGET_CLS = 0.02
/** Observer entries keep arriving while the frozen report stays on screen. */
const MAX_ENTRIES = 500

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
const RULE_STYLE: CSSProperties = {
  margin: '0.2rem 0',
  borderTop: '1px solid rgba(188, 148, 64, 0.35)',
}
const HINT_STYLE: CSSProperties = { marginTop: '0.3rem', opacity: 0.72 }
const TEXT_STYLE: CSSProperties = { margin: '0.15rem 0 0', font: 'inherit' }

interface TimedTask {
  readonly at: number
  readonly duration: number
}

interface ObservedShift {
  readonly at: number
  readonly value: number
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
  readonly longTasks: number
  readonly longTasksSupported: boolean
  readonly cls: number
  readonly clsSupported: boolean
  /** `document.querySelectorAll('*').length` when the window ends. */
  readonly elements: number
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
  /** Warm-up deltas, used for the refresh estimate. */
  warmDeltas: number[]
  longTasks: TimedTask[]
  shifts: ObservedShift[]
  suspended: number
  longTasksSupported: boolean
  clsSupported: boolean
  summary: Summary | null
}

/** `layout-shift` fields that are not part of the DOM lib's PerformanceEntry. */
interface LayoutShiftLike extends PerformanceEntry {
  readonly hadRecentInput?: boolean
  readonly value?: number
}

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
    longTasks: [],
    shifts: [],
    suspended: 0,
    longTasksSupported: false,
    clsSupported: false,
    summary: null,
  }
}

function resetRecorder(recorder: Recorder): void {
  recorder.startedAt = null
  recorder.frames.length = 0
  recorder.nows.length = 0
  recorder.warmDeltas.length = 0
  recorder.longTasks.length = 0
  recorder.shifts.length = 0
  recorder.suspended = 0
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

function sum(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

function windowBounds(recorder: Recorder): { readonly start: number; readonly end: number } {
  const start = (recorder.startedAt ?? 0) + WARMUP_MS
  return { start, end: start + WINDOW_MS }
}

function summarize(recorder: Recorder): Summary {
  const { start, end } = windowBounds(recorder)
  const frames = [...recorder.frames].sort((a, b) => a - b)
  let max = 0
  let over20 = 0
  let over33 = 0
  for (const frame of frames) {
    if (frame > max) max = frame
    if (frame > BUDGET_OVER20_MS) over20 += 1
    if (frame > BUDGET_MAX_MS) over33 += 1
  }
  const n = frames.length
  const inWindow = (at: number): boolean => at >= start && at < end

  return {
    n,
    avg: n === 0 ? 0 : sum(frames) / n,
    p50: percentile(frames, 0.5),
    p95: percentile(frames, 0.95),
    p99: percentile(frames, 0.99),
    max,
    over20,
    over33,
    crossP95: percentile([...recorder.nows].sort((a, b) => a - b), 0.95),
    refresh: median(recorder.warmDeltas),
    suspended: recorder.suspended,
    longTasks: recorder.longTasks.filter((task) => inWindow(task.at)).length,
    longTasksSupported: recorder.longTasksSupported,
    cls: sum(recorder.shifts.filter((shift) => inWindow(shift.at)).map((shift) => shift.value)),
    clsSupported: recorder.clsSupported,
    elements: document.querySelectorAll('*').length,
  }
}

const ms = (value: number): string => value.toFixed(1)

/** `ok`, `FAIL`, or `n/a` when the browser could not measure the metric. */
function marker(pass: boolean | null): string {
  if (pass === null) return 'n/a'
  return pass ? 'ok' : 'FAIL'
}

function report(summary: Summary): string {
  const frameOk = summary.over33 === 0
  const longOk = summary.longTasksSupported ? summary.longTasks === 0 : null
  const clsOk = summary.clsSupported ? summary.cls < BUDGET_CLS : null
  const complete = longOk !== null && clsOk !== null
  const pass = frameOk && longOk !== false && clsOk !== false
  const verdict = !pass ? 'FAIL' : complete ? 'PASS' : 'PARTIAL'

  return [
    `TURN BUDGET ${verdict}`,
    `  frames>33 ${summary.over33} ${marker(frameOk)}`,
    `  long>50 ${summary.longTasksSupported ? summary.longTasks : 'n/a'} ${marker(longOk)}`,
    `  CLS ${summary.clsSupported ? summary.cls.toFixed(3) : 'n/a'} ${marker(clsOk)}`,
    '',
    `n ${summary.n}  ${(WINDOW_MS / 1000).toFixed(1)}s  refresh~${ms(summary.refresh)}ms`,
    `p50 ${ms(summary.p50)}  p95 ${ms(summary.p95)}  p99 ${ms(summary.p99)}`,
    `avg ${ms(summary.avg)}  max ${ms(summary.max)}`,
    `frames >20 ${summary.over20}  >33 ${summary.over33}`,
    `p95<=${ms(BUDGET_P95_MS)} ${marker(summary.p95 <= BUDGET_P95_MS)}  xchk ${ms(summary.crossP95)}`,
    `elements ${summary.elements}  susp ${summary.suspended}`,
  ].join('\n')
}

/**
 * Start a `PerformanceObserver` for one entry type. Returns `null` when the
 * type is unsupported or the constructor throws (locked-down browsers), so the
 * caller can report `n/a` rather than a fabricated zero.
 */
function observe(
  type: string,
  onEntry: (entry: PerformanceEntry) => void,
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null
  const supported = PerformanceObserver.supportedEntryTypes
  if (supported === undefined || !supported.includes(type)) return null

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) onEntry(entry)
    })
    observer.observe({ type, buffered: true })
    return observer
  } catch {
    return null
  }
}

function layoutShiftOf(entry: PerformanceEntry): ObservedShift | null {
  const shift = entry as LayoutShiftLike
  if (shift.hadRecentInput === true) return null
  if (typeof shift.value !== 'number' || !Number.isFinite(shift.value)) return null
  return { at: entry.startTime, value: shift.value }
}

export function PerfOverlay() {
  const textRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const text = textRef.current
    if (text === null) return

    const recorder = createRecorder()
    let frameId: number | null = null
    let running = false

    const write = (value: string): void => {
      text.textContent = value
    }

    const longTaskObserver = observe('longtask', (entry) => {
      if (entry.duration < BUDGET_LONG_TASK_MS) return
      if (recorder.longTasks.length >= MAX_ENTRIES) return
      recorder.longTasks.push({ at: entry.startTime, duration: entry.duration })
    })
    recorder.longTasksSupported = longTaskObserver !== null

    const shiftObserver = observe('layout-shift', (entry) => {
      if (recorder.shifts.length >= MAX_ENTRIES) return
      const shift = layoutShiftOf(entry)
      if (shift !== null) recorder.shifts.push(shift)
    })
    recorder.clsSupported = shiftObserver !== null

    const stopLoop = (): void => {
      running = false
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
        frameId = null
      }
    }

    const schedule = (): void => {
      if (running) frameId = requestAnimationFrame(onFrame)
    }

    const finish = (): void => {
      running = false
      frameId = null
      const summary = summarize(recorder)
      recorder.summary = summary
      write(report(summary))
    }

    const onFrame = (timestamp: number): void => {
      frameId = null
      if (!running) return
      const now = performance.now()

      if (recorder.startedAt === null) {
        recorder.startedAt = timestamp
        recorder.lastStamp = timestamp
        recorder.lastNow = now
        recorder.lastPaint = now
        write('warming up 0.0 / 3.0 s')
        schedule()
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
        schedule()
        return
      }

      const elapsed = timestamp - recorder.startedAt

      if (elapsed < WARMUP_MS) {
        if (recorder.warmDeltas.length < 240) recorder.warmDeltas.push(stampDelta)
        if (now - recorder.lastPaint >= PAINT_MS) {
          recorder.lastPaint = now
          write(`warming up ${(elapsed / 1000).toFixed(1)} / 3.0 s`)
        }
        schedule()
        return
      }

      if (elapsed < WARMUP_MS + WINDOW_MS) {
        recorder.frames.push(stampDelta)
        recorder.nows.push(nowDelta)
        if (now - recorder.lastPaint >= PAINT_MS) {
          recorder.lastPaint = now
          write(`recording ${(elapsed / 1000).toFixed(1)} / 10.0 s\nn ${recorder.frames.length}`)
        }
        schedule()
        return
      }

      finish()
    }

    const startLoop = (): void => {
      if (running) return
      running = true
      frameId = requestAnimationFrame(onFrame)
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

      stopLoop()
      resetRecorder(recorder)
      write('restarting…')
      startLoop()
    }

    window.addEventListener('keydown', onKeyDown)
    startLoop()

    return () => {
      stopLoop()
      window.removeEventListener('keydown', onKeyDown)
      longTaskObserver?.disconnect()
      shiftObserver?.disconnect()
    }
  }, [])

  return (
    <div style={PANEL_STYLE} aria-hidden="true" id="perf-overlay">
      <div style={TITLE_STYLE}>THE LOGBOOK · FRAME TIME</div>
      <pre ref={textRef} style={TEXT_STYLE}>
        starting…
      </pre>
      <div style={RULE_STYLE} />
      <div style={HINT_STYLE}>
        {'budget: 0 frames>33ms, 0 long>50ms, CLS<0.02\nR restart  3s warm-up  10s window'}
      </div>
    </div>
  )
}

export { isPerfEnabled }
