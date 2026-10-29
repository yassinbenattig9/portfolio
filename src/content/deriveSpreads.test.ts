import { describe, expect, it } from 'vitest'
import rawContent from './portfolio.json'
import { deriveContents, deriveSpreads, type Spread } from './deriveSpreads.ts'
import { validateContent } from './loadContent.ts'
import type { Portfolio } from './schema.ts'

const content = (): Portfolio => validateContent(structuredClone(rawContent) as unknown)

const visibleProjects = (document: Portfolio) => document.projects.filter((project) => project.visible)

const projectSpreads = (spreads: readonly Spread[]) =>
  spreads.filter((spread) => spread.kind === 'project')

const allPages = (spreads: readonly Spread[]) => spreads.flatMap((spread) => [spread.left, spread.right])

describe('deriveSpreads ordering', () => {
  it('puts the contents spread first', () => {
    const spreads = deriveSpreads(content())
    const first = spreads[0]

    expect(first?.index).toBe(0)
    expect(first?.kind).toBe('contents')
    expect(first?.key).toBe('contents')
    expect(first?.left).toEqual({ key: 'contents', kind: 'contents' })
    expect(first?.right).toEqual({ key: 'about', kind: 'about' })
    expect(first?.projectId).toBeUndefined()
  })

  it('puts the closing contact spread last', () => {
    const spreads = deriveSpreads(content())
    const last = spreads[spreads.length - 1]

    expect(last?.kind).toBe('closing')
    expect(last?.key).toBe('closing')
    expect(last?.right).toEqual({ key: 'contact', kind: 'contact' })
    expect(last?.projectId).toBeUndefined()
  })

  it('keeps project spreads in JSON array order', () => {
    const document = content()
    const spreads = deriveSpreads(document)

    expect(projectSpreads(spreads).map((spread) => spread.projectId)).toEqual(
      visibleProjects(document).map((project) => project.id),
    )
  })

  it('continues in order after hidden projects are removed', () => {
    const document = content()
    document.projects[1]!.visible = false

    const spreads = deriveSpreads(document)

    expect(projectSpreads(spreads).map((spread) => spread.projectId)).toEqual(
      ['invoice-signer', 'fleet-dashboard', 'group-crm', 'field-app'],
    )
  })
})

describe('deriveSpreads page pairing', () => {
  it('has an even page count and no unpaired pages', () => {
    const spreads = deriveSpreads(content())

    expect(allPages(spreads)).toHaveLength(spreads.length * 2)
    expect(allPages(spreads).length % 2).toBe(0)

    for (const spread of spreads) {
      expect(spread.left).toBeDefined()
      expect(spread.right).toBeDefined()
      expect(spread.left.key).not.toBe('')
      expect(spread.right.key).not.toBe('')
    }
  })

  it('builds 7 spreads over 14 pages for the shipped five visible projects', () => {
    const document = content()
    const spreads = deriveSpreads(document)
    const expectedSpreads = 1 + visibleProjects(document).length + 1

    expect(spreads).toHaveLength(expectedSpreads)
    expect(expectedSpreads).toBe(7)
    expect(allPages(spreads)).toHaveLength(14)
  })

  it('keeps the page count even for any number of visible projects', () => {
    for (const visibleCount of [0, 1, 2, 3]) {
      const document = content()
      document.projects.forEach((project, index) => {
        project.visible = index < visibleCount
      })

      const spreads = deriveSpreads(document)

      expect(spreads).toHaveLength(1 + visibleCount + 1)
      expect(allPages(spreads)).toHaveLength(spreads.length * 2)
      expect(spreads[0]?.kind).toBe('contents')
      expect(spreads[spreads.length - 1]?.kind).toBe('closing')
      expect(spreads[spreads.length - 1]?.right.kind).toBe('contact')
    }
  })

  it('numbers spreads by position', () => {
    const spreads = deriveSpreads(content())

    spreads.forEach((spread, position) => {
      expect(spread.index).toBe(position)
    })
  })
})

describe('deriveSpreads project spreads', () => {
  it('gives every project spread a stable kind, project id and page keys', () => {
    const document = content()
    const spreads = deriveSpreads(document)

    for (const spread of projectSpreads(spreads)) {
      const project = document.projects.find((entry) => entry.id === spread.projectId)

      expect(project).toBeDefined()
      expect(spread.key).toBe(project?.id)
      expect(spread.left.key).toBe(`${project?.id}.story`)
      expect(spread.right.key).toBe(`${project?.id}.demo`)
      expect(spread.left.projectId).toBe(project?.id)
      expect(spread.right.projectId).toBe(project?.id)
      expect(spread.left.kind).toBe(project?.left.layout)
      expect(spread.right.kind).toBe(project?.right.layout)
    }
  })

  it('excludes invisible projects entirely', () => {
    const document = content()
    document.projects[1]!.visible = false

    const spreads = deriveSpreads(document)

    expect(spreads.some((spread) => spread.projectId === 'erp-relay')).toBe(false)
    expect(allPages(spreads).some((page) => page.projectId === 'erp-relay')).toBe(false)
    expect(allPages(spreads)).toHaveLength(12)
  })

  it('does not create project spreads when every project is hidden', () => {
    const document = content()
    document.projects.forEach((project) => {
      project.visible = false
    })

    const spreads = deriveSpreads(document)

    expect(projectSpreads(spreads)).toHaveLength(0)
    expect(spreads.map((spread) => spread.kind)).toEqual(['contents', 'closing'])
  })

  it('uses unique spread keys, page keys and project ids', () => {
    const spreads = deriveSpreads(content())
    const spreadKeys = spreads.map((spread) => spread.key)
    const pageKeys = allPages(spreads).map((page) => page.key)
    const projectIds = projectSpreads(spreads).map((spread) => spread.projectId)

    expect(new Set(spreadKeys).size).toBe(spreadKeys.length)
    expect(new Set(pageKeys).size).toBe(pageKeys.length)
    expect(new Set(projectIds).size).toBe(projectIds.length)
  })

  it('has no project id on the contents and closing spreads', () => {
    const spreads = deriveSpreads(content())

    for (const spread of spreads.filter((entry) => entry.kind !== 'project')) {
      expect(spread.projectId).toBeUndefined()
    }
  })
})

describe('deriveContents', () => {
  it('maps one entry per visible project to its spread index', () => {
    const document = content()
    const spreads = deriveSpreads(document)

    const entries = deriveContents(document, spreads)

    expect(entries).toHaveLength(visibleProjects(document).length)

    for (const entry of entries) {
      const spread = spreads[entry.spreadIndex]
      const project = document.projects.find((candidate) => candidate.id === entry.projectId)

      expect(spread?.kind).toBe('project')
      expect(spread?.projectId).toBe(entry.projectId)
      expect(spread?.index).toBe(entry.spreadIndex)
      expect(entry.title).toBe(project?.title)
    }
  })

  it('lists entries in book order', () => {
    const document = content()

    expect(deriveContents(document, deriveSpreads(document)).map((entry) => entry.projectId)).toEqual([
      'invoice-signer',
      'erp-relay',
      'fleet-dashboard',
      'group-crm',
      'field-app',
    ])
  })

  it('omits hidden projects', () => {
    const document = content()
    document.projects[1]!.visible = false

    const entries = deriveContents(document, deriveSpreads(document))

    expect(entries.map((entry) => entry.projectId)).toEqual([
      'invoice-signer',
      'fleet-dashboard',
      'group-crm',
      'field-app',
    ])
    expect(entries.map((entry) => entry.spreadIndex)).toEqual([1, 2, 3, 4])
  })

  it('returns no entries when the book has no project spreads', () => {
    const document = content()
    document.projects.forEach((project) => {
      project.visible = false
    })

    expect(deriveContents(document, deriveSpreads(document))).toEqual([])
  })

  it('throws when a project spread points at an unknown project', () => {
    const ghost: Spread = {
      index: 9,
      key: 'ghost',
      kind: 'project',
      projectId: 'ghost',
      left: { key: 'ghost.story', kind: 'story', projectId: 'ghost' },
      right: { key: 'ghost.demo', kind: 'demo', projectId: 'ghost' },
    }

    expect(() => deriveContents(content(), [ghost])).toThrow(/no project "ghost"/)
  })
})
