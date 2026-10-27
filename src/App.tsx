import { useEffect, useMemo, useState } from 'react'
import { BookStage } from './book/BookStage'
import { deriveSpreads, type Spread } from './content/deriveSpreads'
import { loadContent } from './content/loadContent'
import type { Portfolio } from './content/schema'
import { isPerfEnabled, PerfOverlay } from './dev/PerfOverlay'
import { getBookState, useBookStore } from './state/bookState'
import { Hint } from './ui/Hint'
import { TopBar } from './ui/TopBar'

interface LoadedContent {
  readonly content: Portfolio
  readonly spreads: readonly Spread[]
}

const EMPTY_SPREADS: readonly Spread[] = []

/**
 * The shell: content loading, the keyboard map and the 2D chrome.
 *
 * The book itself is plain DOM (`src/book`), so it mounts directly: no lazy
 * chunk, no Suspense boundary and no renderer probe.
 */
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

  const phase = useBookStore((state) => state.phase)
  const setSpreadCount = useBookStore((state) => state.setSpreadCount)
  const spreads = loaded.data?.spreads ?? EMPTY_SPREADS
  // `?perf` is a dev instrument: without the flag nothing is mounted and the
  // frame loop is untouched.
  const [perfEnabled] = useState<boolean>(isPerfEnabled)

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
          // During TURNING the close command is dropped by the store: the sheet
          // lands, then the next Esc closes the book. No force-commit here.
          const state = getBookState()
          if (state.phase !== 'OPEN') return
          event.preventDefault()
          state.close(now)
          return
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          // A second arrow mid-turn is dropped by the store (commands are
          // guards), so the sheet is never cut and restarted: fast consecutive
          // turns fall back to "one turn at a time", not a jump-cut.
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

      <BookStage spreads={loaded.data.spreads} content={content} />

      {/* The hint describes book controls, so it exists only with a book. */}
      <Hint phase={phase} />

      {perfEnabled ? <PerfOverlay /> : null}
    </main>
  )
}

export { App }
