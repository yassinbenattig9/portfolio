import { z } from 'zod';

/**
 * The content contract for `portfolio.json`: the single source for the 3D book,
 * the Contents page and the plain HTML version. Every object is strict, so a
 * typo (`hightlights`) fails the build instead of the live site.
 *
 * Bumping `schemaVersion` is a schema change: add a migration step in
 * `loadContent.ts` at the same time.
 */

/** A required string; empty strings mean a forgotten field, so they fail. */
const text = z.string().min(1, 'must not be empty');

/** Media live in `public/media/...`; the JSON must use a site-absolute path. */
const mediaPath = z.string().startsWith('/media/', 'must start with "/media/"');

/** The page template used by the book and by the plain version. */
export const layoutSchema = z.enum(['story', 'demo']);

export const siteThemeSchema = z.literal('daylight');

/** Content language; a second language can be added as a new option later. */
export const siteLanguageSchema = z.enum(['en', 'fr']);

export const siteSchema = z.strictObject({
  name: text,
  role: text,
  theme: siteThemeSchema,
  language: siteLanguageSchema,
});

export const contactSchema = z.strictObject({
  email: z.email('must be a valid email address'),
  linkedin: z.url('must be a valid URL'),
  github: z.url('must be a valid URL'),
  cv: mediaPath,
});

export const aboutSchema = z.strictObject({
  headline: text,
  summary: text,
  languages: z.array(text).min(1, 'list at least one language'),
});

/**
 * How the right page shows a project. `component` points at an animated demo
 * that is registered by id; `media` is a plain image/loop, so adding a project
 * never requires code.
 */
export const demoReferenceSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('component'),
    // TODO(Phase 4): component ids are resolved against a demo registry
    // (planned: src/demos). No component exists yet, so the id in the JSON is
    // a placeholder until that registry lands.
    id: z.string().min(1, 'must not be empty'),
    poster: mediaPath,
  }),
  z.strictObject({
    type: z.literal('media'),
    src: mediaPath,
    poster: mediaPath,
  }),
]);

export const linksSchema = z.strictObject({
  live: z.url('must be a valid URL').nullable(),
  repo: z.url('must be a valid URL').nullable(),
});

export const leftPageSchema = z.strictObject({
  layout: layoutSchema,
});

export const rightPageSchema = z.strictObject({
  layout: layoutSchema,
  demo: demoReferenceSchema.optional(),
});

export const projectSchema = z
  .strictObject({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase slug such as "project-a"'),
    visible: z.boolean(),
    title: text,
    period: text,
    role: text,
    summary: text,
    highlights: z.array(text).min(1, 'list at least one highlight'),
    stack: z.array(text).min(1, 'list at least one stack item'),
    links: linksSchema,
    left: leftPageSchema,
    right: rightPageSchema,
  })
  .superRefine((project, ctx) => {
    const { layout, demo } = project.right;

    if (layout === 'demo' && demo === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'layout "demo" requires a demo reference',
        path: ['right', 'demo'],
      });
    }

    if (layout !== 'demo' && demo !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a demo reference is only allowed when layout is "demo"',
        path: ['right', 'demo'],
      });
    }

    if (project.left.layout === 'demo') {
      ctx.addIssue({
        code: 'custom',
        message: 'the left page is a story page, so it cannot use layout "demo"',
        path: ['left', 'layout'],
      });
    }
  });

export const projectsSchema = z.array(projectSchema).superRefine((projects, ctx) => {
  const firstIndexById = new Map<string, number>();

  projects.forEach((project, index) => {
    const firstIndex = firstIndexById.get(project.id);
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `duplicate project id "${project.id}" (already used at projects[${firstIndex}])`,
        path: [index, 'id'],
      });
      return;
    }
    firstIndexById.set(project.id, index);
  });
});

export const portfolioSchema = z.strictObject({
  schemaVersion: z.literal(1),
  site: siteSchema,
  contact: contactSchema,
  about: aboutSchema,
  // No fixed length: order is book order, and projects are added or removed by
  // editing the array (see plan §4.2). The current file has three projects.
  projects: projectsSchema,
});

/** The workbook. Derived spread types live in `deriveSpreads.ts`. */
export type Portfolio = z.infer<typeof portfolioSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type About = z.infer<typeof aboutSchema>;
export type ProjectLinks = z.infer<typeof linksSchema>;
export type DemoReference = z.infer<typeof demoReferenceSchema>;
export type PageLayout = z.infer<typeof layoutSchema>;
export type RightPage = z.infer<typeof rightPageSchema>;
export type LeftPage = z.infer<typeof leftPageSchema>;
