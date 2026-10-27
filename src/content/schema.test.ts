import { describe, expect, it } from 'vitest'
import rawContent from './portfolio.json'
import { loadContent, migrate, validateContent } from './loadContent.ts'
import { portfolioSchema, projectSchema, type Portfolio } from './schema.ts'

/**
 * A fresh, mutable copy of the shipped document. Tests mutate one field at a
 * time so each failure has exactly one reason.
 */
type LooseDocument = Record<string, any>

const shippedDocument = (): LooseDocument =>
  structuredClone(rawContent) as unknown as LooseDocument

const validDocument = (): Portfolio => validateContent(shippedDocument())

const projectA = (): Portfolio['projects'][number] => {
  const project = validDocument().projects[0]
  if (project === undefined) throw new Error('fixture expects at least one project')
  return project
}

describe('the shipped portfolio.json', () => {
  it('parses through loadContent()', () => {
    const content = loadContent()

    expect(content.schemaVersion).toBe(1)
    expect(content.site.name.length).toBeGreaterThan(0)
    expect(content.projects.length).toBeGreaterThan(0)
  })

  it('memoises the validated document', () => {
    expect(loadContent()).toBe(loadContent())
  })

  it('is accepted by the schema directly', () => {
    const result = portfolioSchema.safeParse(shippedDocument())

    expect(result.success).toBe(true)
  })
})

describe('strict objects', () => {
  it('rejects an unknown key in a nested object', () => {
    const document = shippedDocument()
    document.site.tagline = 'a typo that must fail the build'

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.code).toBe('unrecognized_keys')
    expect(result.error.issues[0]?.path).toEqual(['site'])
  })

  it('rejects an unknown key at the document root', () => {
    const document = shippedDocument()
    document.extra = true

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.code).toBe('unrecognized_keys')
  })

  it('rejects an unknown key on a project', () => {
    const document = shippedDocument()
    document.projects[0].hightlights = ['misplaced typo']

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.code).toBe('unrecognized_keys')
    expect(result.error.issues[0]?.path).toEqual(['projects', 0])
  })
})

describe('required fields', () => {
  it('rejects a missing field and names its path', () => {
    const document = shippedDocument()
    delete document.contact.email

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    // Zod reports the missing value through the email validator, but the path
    // is what the build log needs to point at.
    expect(result.error.issues[0]?.path).toEqual(['contact', 'email'])
  })

  it('rejects an empty required string', () => {
    const document = shippedDocument()
    document.about.headline = ''

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['about', 'headline'])
  })

  it('rejects an empty highlights list', () => {
    const document = shippedDocument()
    document.projects[0].highlights = []

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['projects', 0, 'highlights'])
  })

  it('reports the field path in the thrown build error', () => {
    const document = shippedDocument()
    delete document.contact.email

    expect(() => validateContent(document)).toThrow(/contact\.email/)
  })
})

describe('project ids', () => {
  it('rejects duplicate ids and points at the later one', () => {
    const document = shippedDocument()
    document.projects[1].id = document.projects[0].id

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['projects', 1, 'id'])
    expect(result.error.issues[0]?.message).toMatch(/duplicate project id/)
  })

  it('rejects an id that is not a lowercase slug', () => {
    const document = shippedDocument()
    document.projects[0].id = 'Project A'

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['projects', 0, 'id'])
  })
})

describe('media paths', () => {
  it('rejects a CV path that is not site-absolute', () => {
    const document = shippedDocument()
    document.contact.cv = 'media/cv.pdf'

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['contact', 'cv'])
    expect(result.error.issues[0]?.message).toMatch(/\/media\//)
  })

  it('rejects a demo poster that is not site-absolute', () => {
    const document = shippedDocument()
    document.projects[0].right.demo.poster = 'https://example.com/poster.webp'

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['projects', 0, 'right', 'demo', 'poster'])
  })
})

describe('demo reference rules', () => {
  it('requires a demo reference when the right page layout is "demo"', () => {
    const document = shippedDocument()
    delete document.projects[0].right.demo

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual(['projects', 0, 'right', 'demo'])
  })

  it('rejects a left page that uses the "demo" layout', () => {
    const document = shippedDocument()
    document.projects[0].left.layout = 'demo'

    const result = portfolioSchema.safeParse(document)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
      'projects',
      0,
      'left',
      'layout',
    ])
  })
})

describe('migrate', () => {
  it('passes a version 1 document through unchanged', () => {
    const document = shippedDocument()

    expect(migrate(document)).toBe(document)
  })

  it('throws for an unsupported schemaVersion', () => {
    const document = shippedDocument()
    document.schemaVersion = 2

    expect(() => migrate(document)).toThrow(/unsupported schemaVersion 2/)
    expect(() => validateContent(document)).toThrow(/unsupported schemaVersion 2/)
  })

  it('throws for a non-numeric schemaVersion', () => {
    const document = shippedDocument()
    document.schemaVersion = '1'

    expect(() => migrate(document)).toThrow(/unsupported schemaVersion/)
  })

  it('throws for a document root that is not an object', () => {
    expect(() => migrate(null)).toThrow(/expected a JSON object/)
    expect(() => migrate([])).toThrow(/expected a JSON object/)
  })
})

describe('projectSchema', () => {
  it('accepts a single valid project', () => {
    expect(projectSchema.safeParse(projectA()).success).toBe(true)
  })
})
