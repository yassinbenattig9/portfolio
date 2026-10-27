import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBookStore } from '../state/bookState.ts'
import { parseFreeze } from './freeze.ts'

/**
 * `getFreeze` caches its first parse in module scope. Each scenario therefore
 * loads a fresh copy of the module and stubs `location` for that copy only.
 */
async function loadWithLocation(search: string): Promise<{
  get: () => ReturnType<typeof parseFreeze>
  location: { search: string }
}> {
  vi.resetModules()
  const location = { search }
  vi.stubGlobal('location', location)
  const { getFreeze } = await import('./freeze.ts')
  return { get: getFreeze, location }
}

const SEARCHES_WITHOUT_A_FREEZE = [
  '',
  '?',
  '?dir=back',
  '?freeze=',
  '?freeze=%20',
  '?freeze=abc',
  '?freeze=NaN',
  '?freeze=Infinity',
  '?freeze=0.5abc',
  '?freeze=0,5',
  '?freeze=true',
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('parseFreeze: valid freeze requests', () => {
  it('parses a forward freeze in the middle of a turn', () => {
    expect(parseFreeze('?freeze=0.5')).toEqual({
      progress: 0.5,
      dir: 1,
      direction: 'forward',
    })
  })

  it('parses both endpoints of the turn', () => {
    expect(parseFreeze('?freeze=0')).toEqual({ progress: 0, dir: 1, direction: 'forward' })
    expect(parseFreeze('?freeze=1')).toEqual({ progress: 1, dir: 1, direction: 'forward' })
  })

  it('parses a backward freeze and keeps the URL spelling', () => {
    expect(parseFreeze('?freeze=0.5&dir=back')).toEqual({
      progress: 0.5,
      dir: -1,
      direction: 'back',
    })
  })

  it('accepts a search string without the leading question mark', () => {
    expect(parseFreeze('freeze=0.25&dir=back')).toEqual({
      progress: 0.25,
      dir: -1,
      direction: 'back',
    })
  })

  it('defaults to forward when dir is absent, empty or unknown', () => {
    for (const search of [
      '?freeze=0.25',
      '?freeze=0.25&dir=',
      '?freeze=0.25&dir=forwards',
      '?freeze=0.25&dir=BACK',
      '?freeze=0.25&dir=sideways',
    ]) {
      expect(parseFreeze(search), search).toEqual({
        progress: 0.25,
        dir: 1,
        direction: 'forward',
      })
    }
  })

  it('accepts ordinary numeric spellings that are inside the window', () => {
    expect(parseFreeze('?freeze=1e-1')?.progress, 'scientific').toBe(0.1)
    expect(parseFreeze('?freeze=0.5%20')?.progress, 'trailing space').toBe(0.5)
    expect(parseFreeze('?freeze=0.5&dir=back')?.progress, 'with direction').toBe(0.5)
  })
})

describe('parseFreeze: no freeze', () => {
  it('returns null when the freeze parameter is absent or blank', () => {
    for (const search of SEARCHES_WITHOUT_A_FREEZE.slice(0, 5)) {
      expect(parseFreeze(search), search).toBeNull()
    }
  })

  it('rejects out-of-range progress instead of clamping it (implementation differs from the stated clamp contract)', () => {
    // The brief says out-of-range values are clamped; the implementation
    // returns null. Pinning the actual behaviour: a bogus freeze is safer than
    // a silent pose, but it means `?freeze=1.5` disables the harness rather
    // than pinning it at 1. Reported as a contract mismatch, source untouched.
    for (const raw of ['-0.001', '-1', '1.001', '2', '1e3', '-1e3']) {
      expect(parseFreeze(`?freeze=${raw}`), raw).toBeNull()
    }
  })

  it('never returns a pose for garbage or non-finite progress', () => {
    for (const search of SEARCHES_WITHOUT_A_FREEZE) {
      expect(parseFreeze(search), search).toBeNull()
    }
  })

  it('only ever returns a finite progress inside the turn and a consistent direction', () => {
    const searches = [
      '?freeze=0',
      '?freeze=0.5',
      '?freeze=1',
      '?freeze=0.5&dir=back',
      ...SEARCHES_WITHOUT_A_FREEZE,
    ]

    for (const search of searches) {
      const freeze = parseFreeze(search)
      if (freeze === null) continue
      expect(Number.isFinite(freeze.progress), search).toBe(true)
      expect(freeze.progress, search).toBeGreaterThanOrEqual(0)
      expect(freeze.progress, search).toBeLessThanOrEqual(1)
      expect(freeze.dir, search).toBe(freeze.direction === 'back' ? -1 : 1)
    }
  })
})

describe('parseFreeze: store isolation', () => {
  it('never mutates the book store or notifies a subscriber', () => {
    const before = useBookStore.getState()
    const listener = vi.fn()
    const unsubscribe = useBookStore.subscribe(listener)

    try {
      for (const search of [
        '?freeze=0.5',
        '?freeze=0.9&dir=back',
        ...SEARCHES_WITHOUT_A_FREEZE,
      ]) {
        parseFreeze(search)
      }

      // Identity, not just equality: any `set` would allocate a new state.
      expect(useBookStore.getState()).toBe(before)
      expect(listener).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })
})

describe('getFreeze', () => {
  it('returns null when location is unavailable', async () => {
    vi.resetModules()
    vi.stubGlobal('location', undefined)
    const { getFreeze } = await import('./freeze.ts')
    expect(getFreeze()).toBeNull()
  })

  it('reads the freeze request from location.search', async () => {
    const { get } = await loadWithLocation('?freeze=0.4&dir=back')
    expect(get()).toEqual({ progress: 0.4, dir: -1, direction: 'back' })
  })

  it('returns null for a page load without a freeze parameter', async () => {
    const { get } = await loadWithLocation('?dir=back')
    expect(get()).toBeNull()
  })

  it('parses the URL once and keeps the first result even if search changes', async () => {
    const { get, location } = await loadWithLocation('?freeze=0.4&dir=back')
    const first = get()

    location.search = '?freeze=0.9'
    expect(get()).toBe(first)
    expect(get()).toEqual({ progress: 0.4, dir: -1, direction: 'back' })
  })

  it('reads the freeze without writing to the store', async () => {
    const before = useBookStore.getState()
    const listener = vi.fn()
    const unsubscribe = useBookStore.subscribe(listener)

    try {
      const { get } = await loadWithLocation('?freeze=0.5')
      expect(get()?.progress).toBe(0.5)
      expect(useBookStore.getState()).toBe(before)
      expect(listener).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })
})
