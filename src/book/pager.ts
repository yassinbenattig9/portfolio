import type { TurnDir } from '../state/bookState'
import type { PageRef } from './pageLookup'

/**
 * Single-page paging geometry (plan §5.5).
 *
 * On a narrow screen the spread is not shown: the reader sees one page at a
 * time, in book order. The book model is still "spreads of two pages", so this
 * module is the only place that knows how a page index maps onto a spread and
 * a side:
 *
 *   ordinal 0 -> { spread: 0, side: 'left' }    e.g. Contents
 *   ordinal 1 -> { spread: 0, side: 'right' }   e.g. About
 *   ordinal 2 -> { spread: 1, side: 'left' }    e.g. project 1, story
 *
 * Paging within a spread only changes the side, which is local UI state; the
 * store has no side to update. Crossing a spread boundary is a real book turn
 * and must go through `next()` / `prev()`.
 *
 * Pure: no DOM, no React, no store access, so every rule here is unit-testable
 * and both the stage and any future swipe surface agree.
 */

/** A page position: one side of one spread. */
export type PagePosition = PageRef

/**
 * `'side'` = same spread, flip the visible side without touching the store.
 * `'spread'` = boundary crossed, the caller must call `next()` / `prev()`.
 */
export type PagerKind = 'side' | 'spread'

export interface PagerStep {
  /** Where the reader lands. */
  readonly to: PagePosition
  readonly kind: PagerKind
  /** Travel direction, the same sign the store uses for a turn. */
  readonly dir: TurnDir
}

/** Total pages in the book: two per spread. */
export function pageCount(spreadCount: number): number {
  return Number.isFinite(spreadCount) && spreadCount > 0 ? Math.trunc(spreadCount) * 2 : 0
}

/** Reading-order index of a page, clamped so a bad position can never throw. */
export function ordinalOf(position: PagePosition): number {
  const spread = Number.isFinite(position.spread) ? Math.max(0, Math.trunc(position.spread)) : 0
  return spread * 2 + (position.side === 'right' ? 1 : 0)
}

/** The page at a reading-order index; out-of-range indexes clamp to the ends. */
export function positionAt(ordinal: number, spreadCount: number): PagePosition {
  const total = pageCount(spreadCount)
  if (total === 0) return { spread: 0, side: 'left' }
  const index = Number.isFinite(ordinal) ? Math.trunc(ordinal) : 0
  const clamped = Math.min(Math.max(index, 0), total - 1)
  return { spread: Math.floor(clamped / 2), side: clamped % 2 === 0 ? 'left' : 'right' }
}

/** The same position, made legal for a book of `spreadCount` spreads. */
export function clampPosition(position: PagePosition, spreadCount: number): PagePosition {
  return positionAt(ordinalOf(position), spreadCount)
}

/**
 * One page forward, or `null` at the last page.
 *
 * The kind is derived from the spread the destination sits in, not from the
 * position's arithmetic: `spread: 0, side: 'right'` -> `spread: 1, side:
 * 'left'` crosses a boundary and is a `'spread'` step, while
 * `spread: 3, side: 'left'` -> `spread: 3, side: 'right'` is a `'side'` step.
 */
export function advance(position: PagePosition, spreadCount: number): PagerStep | null {
  return move(position, spreadCount, 1)
}

/** One page back, or `null` at the first page. */
export function retreat(position: PagePosition, spreadCount: number): PagerStep | null {
  return move(position, spreadCount, -1)
}

/** Direction-aware `advance` / `retreat`, for keyboard, swipe and buttons. */
export function stepFor(
  dir: TurnDir,
  position: PagePosition,
  spreadCount: number,
): PagerStep | null {
  return dir === 1 ? advance(position, spreadCount) : retreat(position, spreadCount)
}

function move(position: PagePosition, spreadCount: number, dir: TurnDir): PagerStep | null {
  const total = pageCount(spreadCount)
  if (total === 0) return null

  const current = ordinalOf(position)
  const next = current + dir
  if (next < 0 || next > total - 1) return null

  const to = positionAt(next, spreadCount)
  const sameSpread = to.spread === positionAt(current, spreadCount).spread

  return { to, kind: sameSpread ? 'side' : 'spread', dir }
}
