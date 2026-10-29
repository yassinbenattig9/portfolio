import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PageContent, type PageVariant } from './PageContent.tsx'
import { deriveContents, deriveSpreads, type Page } from '../content/deriveSpreads.ts'
import type { Contact, Portfolio, Project, Site } from '../content/schema.ts'
import type { PageSide } from './pageLookup.ts'

/**
 * Rendering tests for the page body. They run in the pure node environment
 * with `react-dom/server`: no jsdom, no browser, only serialized markup —
 * which is exactly the contract being tested (which elements exist, whether
 * they are buttons or inert spans, which ids/labels they carry).
 *
 * The jump targets are the `spreadIndex` values derived by `deriveSpreads`/
 * `deriveContents` from a minimal synthetic document, so the Contents page
 * and the book cannot disagree about where a row points.
 */

const site: Site = {
  name: 'Test Author',
  role: 'Developer',
  theme: 'daylight',
  language: 'en',
}

const contact: Contact = {
  email: 'test@example.dev',
  linkedin: 'https://www.example.com/linkedin/test',
  github: 'https://www.example.com/github/test',
  cv: '/media/cv.pdf',
}

const project = (id: string, overrides?: Partial<Project>): Project => ({
  id,
  visible: true,
  title: id === 'alpha' ? 'Alpha Project' : 'Beta Project',
  period: '2024 – present',
  role: 'Solo developer',
  summary: `The ${id} summary.`,
  highlights: [`One ${id} highlight`],
  stack: ['TypeScript'],
  links:
    id === 'alpha'
      ? { live: 'https://alpha.example.com', repo: 'https://example.com/alpha' }
      : { live: null, repo: null },
  left: { layout: 'story' },
  right: {
    layout: id === 'alpha' ? 'story' : 'demo',
    ...(id === 'alpha' ? {} : { demo: { type: 'media', src: '/media/beta/loop.webp', poster: '/media/beta/poster.webp' } }),
  },
  ...overrides,
})

const content = (): Portfolio => ({
  schemaVersion: 1,
  site,
  contact,
  about: { headline: 'About headline', summary: 'About summary', languages: ['English'] },
  projects: [project('alpha'), project('beta')],
})

const render = (props: Parameters<typeof PageContent>[0]): string =>
  renderToStaticMarkup(createElement(PageContent, props))

const contentsPage: Page = { key: 'contents', kind: 'contents' }

const storyPage: Page = { key: 'alpha.story', kind: 'story', projectId: 'alpha' }

const derived = () => {
  const document = content()
  return { document, spreads: deriveSpreads(document), contents: deriveContents(document, deriveSpreads(document)) }
}

/** Every occurrence of a whole element, e.g. all `<h2 ...>…</h2>` blocks. */
const elements = (html: string, tag: string): RegExpMatchArray =>
  html.match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'g')) ?? []

describe('PageContent contents page, page variant (the static render)', () => {
  it('renders one button per Contents row, pointing at the row’s derived spread', () => {
    const { contents } = derived()
    expect(contents.length).toBeGreaterThanOrEqual(2)

    const html = render({
      page: contentsPage,
      side: 'left' satisfies PageSide,
      variant: 'page' satisfies PageVariant,
      contents,
      onJump: vi.fn(),
    })

    const rows = elements(html, 'button')
    expect(rows.length).toBe(contents.length)

    rows.forEach((row, index) => {
      const entry = contents[index]
      expect(row).toContain(`<span class="page__contents-index" aria-hidden="true">${String(entry.spreadIndex).padStart(2, '0')}</span>`)
      expect(row).toContain(`<span class="page__contents-title">${entry.title}</span>`)
      expect(row).toContain(`<span class="page__contents-period">${entry.period}</span>`)
    })
  })

  it('lands the heading id, the labelled-by wiring and the –1 heading tab order', () => {
    const { contents } = derived()
    const html = render({ page: contentsPage, side: 'right', variant: 'page', contents })

    expect(html).toContain('aria-labelledby="page-title-contents"')
    expect(html).toContain('id="page-title-contents"')
    const headings = elements(html, 'h2')
    expect(headings.length).toBe(1)
    expect(headings[0]).toContain('id="page-title-contents"')
    expect(headings[0]).toContain('tabindex="-1"')
  })
})

describe('PageContent contents page, sheet variant (the turning clone)', () => {
  it('renders the same rows as inert spans: no button, no link, no tab stop', () => {
    const { contents } = derived()
    const html = render({ page: contentsPage, side: 'left', variant: 'sheet', contents, onJump: vi.fn() })

    expect(html).not.toContain('<button')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('tabindex')
    expect(html).not.toContain('href=')
    expect((html.match(/<span class="page__contents-row"/g) ?? []).length).toBe(contents.length)
  })

  it('sets no ids at all, so a clone can never duplicate the page’s heading id', () => {
    const { contents } = derived()
    const sheet = render({ page: contentsPage, side: 'left', variant: 'sheet', contents })
    const page = render({ page: contentsPage, side: 'left', variant: 'page', contents })

    expect(sheet).not.toContain('id="')
    // Together, one page render + its clone contain exactly one heading id.
    expect(page.match(/id="page-title-contents"/g)?.length).toBe(1)
    expect(sheet.match(/id="page-title-contents"/g)?.length).toBe(0)
  })

  it('keeps the eyebrow and every row’s text on the clone', () => {
    const { contents } = derived()
    const html = render({ page: contentsPage, side: 'left', variant: 'sheet', contents })

    expect(html).toContain('page__eyebrow')
    for (const entry of contents) {
      expect(html).toContain(entry.title)
      expect(html).toContain(entry.period)
    }
  })
})

describe('PageContent project links across variants', () => {
  it('renders live/repository as real external anchors with labels on the page variant', () => {
    const { document } = derived()
    const html = render({
      page: storyPage,
      project: document.projects[0],
      side: 'left',
      variant: 'page',
    })

    const anchors = elements(html, 'a')
    expect(anchors.length).toBe(2)
    expect(anchors[0]).toContain('href="https://alpha.example.com"')
    expect(anchors[0]).toContain('target="_blank"')
    expect(anchors[0]).toContain('rel="noreferrer noopener"')
    expect(anchors[0]).toContain('aria-label="Alpha Project live site (opens in a new tab)"')
    expect(anchors[1]).toContain('aria-label="Alpha Project repository (opens in a new tab)"')
  })

  it('renders the same links as inert spans on the sheet variant', () => {
    const { document } = derived()
    const html = render({
      page: storyPage,
      project: document.projects[0],
      side: 'left',
      variant: 'sheet',
    })

    expect((html.match(/<span class="page__link">/g) ?? []).length).toBe(2)
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('tabindex')
  })
})

describe('PageContent contact links across variants', () => {
  it('renders email/LinkedIn/GitHub as anchors with labels on the page variant', () => {
    const { document } = derived()
    const html = render({
      page: { key: 'contact', kind: 'contact' },
      contact: document.contact,
      site: document.site,
      side: 'right',
      variant: 'page',
    })

    expect(html).toContain('href="mailto:test@example.dev"')
    expect(html).toContain('aria-label="Email Test Author at test@example.dev"')
    expect((html.match(/<a /g) ?? []).length).toBe(3)
  })

  it('renders email/LinkedIn/GitHub as inert spans on the sheet variant', () => {
    const { document } = derived()
    const html = render({
      page: { key: 'contact', kind: 'contact' },
      contact: document.contact,
      site: document.site,
      side: 'right',
      variant: 'sheet',
    })

    expect(html).not.toContain('<a ')
    expect(html).not.toContain('mailto:')
    expect((html.match(/<span class="page__link">/g) ?? []).length).toBe(3)
    expect(html).toContain('test@example.dev')
  })
})
