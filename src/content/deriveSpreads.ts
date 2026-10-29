import type { Portfolio, Project } from './schema';

/**
 * Turns the content into the book's spreads. Deliberately free of React, the
 * store and three.js: the 3D book, the CSS-3D fallback and the plain HTML page
 * all reuse this so they cannot disagree about order or page count.
 */

export type SpreadKind = 'contents' | 'project' | 'closing';

export type PageKind = 'contents' | 'about' | 'story' | 'demo' | 'blank' | 'contact';

export interface Page {
  /** Stable key, e.g. `contents`, `project-a.story`, `blank`, `contact`. */
  readonly key: string;
  readonly kind: PageKind;
  /** Present on project pages only. */
  readonly projectId?: string;
}

export interface Spread {
  /** 0-based position in the book; Contents entries jump to this. */
  readonly index: number;
  /** Stable key, e.g. `contents`, `project-a`, `closing`. */
  readonly key: string;
  readonly kind: SpreadKind;
  /** Present on project spreads only. */
  readonly projectId?: string;
  readonly left: Page;
  readonly right: Page;
}

/** A Contents entry: what to show and which spread it opens. */
export interface ContentsEntry {
  readonly projectId: string;
  readonly title: string;
  /** The project's period line, shown on the Contents row. */
  readonly period: string;
  readonly spreadIndex: number;
}

function projectPage(project: Project, side: 'story' | 'demo'): Page {
  const layout = side === 'story' ? project.left.layout : project.right.layout;
  return { key: `${project.id}.${side}`, kind: layout, projectId: project.id };
}

/**
 * Contents spread first, one spread per visible project in JSON array order,
 * closing/contact spread last.
 */
export function deriveSpreads(content: Portfolio): Spread[] {
  const pages: Page[] = [
    { key: 'contents', kind: 'contents' },
    { key: 'about', kind: 'about' },
  ];

  for (const project of content.projects) {
    if (!project.visible) continue; // hidden projects take no pages at all
    pages.push(projectPage(project, 'story'), projectPage(project, 'demo'));
  }

  // A spread is a left/right pair and the contact page must stay last. The
  // contact page therefore has to land on a right-hand page: if the body
  // already ends on one, a ruled blank page keeps the pairing instead of
  // pushing contact onto the left. This is what keeps the page count even.
  if (pages.length % 2 === 0) {
    pages.push({ key: 'blank', kind: 'blank' });
  }

  pages.push({ key: 'contact', kind: 'contact' });

  const spreads: Spread[] = [];

  for (let index = 0; index < pages.length; index += 2) {
    const left = pages[index];
    const right = pages[index + 1];

    if (left === undefined || right === undefined) {
      throw new Error(`deriveSpreads: unpaired page at index ${index}; page count must be even`);
    }

    const projectId = left.projectId;
    const isContents = left.kind === 'contents';

    const kind: SpreadKind = isContents
      ? 'contents'
      : projectId === undefined
        ? 'closing'
        : 'project';
    const key = isContents ? 'contents' : (projectId ?? 'closing');

    spreads.push({
      index: spreads.length,
      key,
      kind,
      ...(projectId === undefined ? {} : { projectId }),
      left,
      right,
    });
  }

  return spreads;
}

/** Contents entries in book order: one per visible project spread. */
export function deriveContents(content: Portfolio, spreads: readonly Spread[]): ContentsEntry[] {
  return spreads.flatMap((spread) => {
    if (spread.kind !== 'project' || spread.projectId === undefined) return [];

    const project = content.projects.find((entry) => entry.id === spread.projectId);
    if (project === undefined) {
      throw new Error(`deriveContents: spread ${spread.index} has no project "${spread.projectId}"`);
    }

    return [
      {
        projectId: project.id,
        title: project.title,
        period: project.period,
        spreadIndex: spread.index,
      },
    ];
  });
}
