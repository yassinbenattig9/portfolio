import { useEffect, useMemo } from 'react'
import { deriveSpreads, type Spread } from './content/deriveSpreads'
import { loadContent } from './content/loadContent'
import type { Portfolio } from './content/schema'
import { Scene } from './scene/Scene'
import { getBookState, useBookStore, type BookPhase } from './state/bookState'

interface LoadedContent {
  readonly content: Portfolio
  readonly spreads: readonly Spread[]
}

const EMPTY_SPREADS: readonly Spread[] = []

const HINTS: Readonly<Record<BookPhase, string>> = {
  CLOSED: 'Click the book or press Space to open',
  OPENING: 'Opening…',
  OPEN: 'Left / Right turn pages · Esc closes',
  TURNING: 'Turning…',
  CLOSING: 'Closing…',
}

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

  useEffect(() => {
    setSpreadCount(spreads.length)
  }, [spreads.length, setSpreadCount])

  useEffect(() => {
    if (loaded.data === null) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
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

  return (
    <main className="app">
      <h1 className="visually-hidden">The Logbook — interactive portfolio</h1>
      <div className="app__scene">
        <Scene spreads={loaded.data.spreads} content={loaded.data.content} />
      </div>
      <p className="app__hint" aria-live="polite">
        {HINTS[phase]}
      </p>
    </main>
  )
}

export { App }
