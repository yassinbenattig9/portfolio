import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { deriveSpreads, type Spread } from './content/deriveSpreads'
import { loadContent } from './content/loadContent'
import type { Portfolio } from './content/schema'
import { isPerfEnabled, PerfOverlay } from './dev/PerfOverlay'
import { getBookState, useBookStore } from './state/bookState'
import { Hint } from './ui/Hint'
import { detectWebGL, NoWebGL } from './ui/NoWebGL'
import { TopBar } from './ui/TopBar'

interface LoadedContent {
  readonly content: Portfolio
  readonly spreads: readonly Spread[]
}

const EMPTY_SPREADS: readonly Spread[] = []

/**
 * The lazy boundary (plan §7.7): `src/scene` is the only place that imports
 * three and React Three Fiber, so this dynamic import splits the whole 3D
 * bundle into its own chunk that loads after the 2D shell has painted.
 * `Scene` is a named export, hence the explicit `default` mapping.
 */
const Scene = lazy(() => import('./scene/Scene').then((module) => ({ default: module.Scene })))

function App() {
  const loaded = useMemo<{ data: LoadedContent | null; error: string | null }>(() => {
    // The content is validated by the schema. If that fails, show the field
    // path here instead of a blank page (a broken JSON should be visible).
    try {
      const content = loadContent()
      return { data: { content, spreads: deriveSpreads(content) }, error: null }
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [])

  // Probed once, on the client, before the scene is ever requested: without
  // WebGL the 3D chunk is not downloaded at all.
  const [hasWebGL] = useState<boolean>(detectWebGL)
  // `?perf` is a dev instrument (frame-time evidence, plan §7.7): without the
  // flag nothing is mounted and the frame loop is untouched.
  const [perfEnabled] = useState<boolean>(isPerfEnabled)

  const phase = useBookStore((state) => state.phase)
  const setSpreadCount = useBookStore((state) => state.setSpreadCount)
  const spreads = loaded.data?.spreads ?? EMPTY_SPREADS

  useEffect(() => {
    setSpreadCount(spreads.length)
  }, [spreads.length, setSpreadCount])

  useEffect(() => {
    if (loaded.data === null) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      if (target instanceof HTMLElement) {
        // Never steal a key from a form control, an editable region or a link:
        // Enter on "Plain version" must navigate, not open the book.
        if (target.isContentEditable) return
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return
        if (target.closest('[role="button"]') !== null) return
      }

      const now = performance.now()

      switch (event.key) {
        case ' ':
        case 'Enter': {
          if (getBookState().phase !== 'CLOSED') return
          event.preventDefault()
          getBookState().openBook(now)
          return
        }
        case 'Escape': {
          // TODO(T7): a TURNING phase will be committed by the curl animation.
          // Until then, recover here so Esc can never leave the book stuck.
          if (getBookState().phase === 'TURNING') getBookState().commitTurn()
          const state = getBookState()
          if (state.phase !== 'OPEN') return
          event.preventDefault()
          state.close(now)
          return
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          // TODO(T7): the visible turn (curl) is not implemented yet. Committing
          // the previous turn here is what keeps navigation from freezing; it is
          // the exact spot the animation will replace.
          if (getBookState().phase === 'TURNING') getBookState().commitTurn()
          const state = getBookState()
          if (state.phase !== 'OPEN') return
          event.preventDefault()
          if (event.key === 'ArrowRight') state.next(now)
          else state.prev(now)
          return
        }
        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [loaded.data])

  if (loaded.data === null) {
    return (
      <main className="app app--error">
        <h1>The Logbook</h1>
        <p role="alert">The portfolio content could not be loaded.</p>
        <pre>{loaded.error}</pre>
      </main>
    )
  }

  const { content } = loaded.data

  return (
    <main className="app">
      <h1 className="visually-hidden">The Logbook — interactive portfolio</h1>
      <TopBar site={content.site} contact={content.contact} />

      {hasWebGL ? (
        <>
          <div className="app__scene">
            {/* Styled placeholder, not a blank screen: the shell is readable
                while the 3D chunk downloads (real art is Phase 2). */}
            <Suspense
              fallback={
                <div className="app__placeholder">
                  <p className="app__placeholder-name">{content.site.name}</p>
                  <p className="app__placeholder-role">{content.site.role}</p>
                  <p className="app__placeholder-note">Setting the desk…</p>
                </div>
              }
            >
              <Scene spreads={loaded.data.spreads} content={content} />
            </Suspense>
          </div>
          {/* The hint describes book controls, so it exists only with a book. */}
          <Hint phase={phase} />
          {perfEnabled ? <PerfOverlay /> : null}
        </>
      ) : (
        <NoWebGL site={content.site} contact={content.contact} />
      )}
    </main>
  )
}

export { App }
