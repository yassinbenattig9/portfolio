import { z } from 'zod';
import rawContent from './portfolio.json';
import { portfolioSchema, type Portfolio } from './schema';

/**
 * Loads the JSON "database". The file is validated through the schema, so a
 * broken field fails the build with its field path instead of the live site.
 */

/** The schema versions this build understands. Add a `migrate` step to bump. */
const SUPPORTED_SCHEMA_VERSIONS = [1] as const;

/** Renders a Zod issue path as `contact.email` / `projects[0].highlights[1]`. */
function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(document root)';

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') return `${formatted}[${segment}]`;
    return formatted.length === 0 ? String(segment) : `${formatted}.${String(segment)}`;
  }, '');
}

/**
 * Reports every issue with its exact field path and the reason, so the build
 * log says what to fix, plus Zod's own report for context.
 */
function describeIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => `  - ${formatPath(issue.path)}: ${issue.message}`);

  return [
    `Invalid portfolio content (${error.issues.length} issue${error.issues.length === 1 ? '' : 's'}):`,
    ...lines,
    '',
    'Zod report:',
    z.prettifyError(error),
  ].join('\n');
}

/**
 * Upgrades older documents to the current schema. Today only version 1 exists,
 * so this is a pass-through; every future schema change adds a case here
 * (for example `case 1: return upgradeV1ToV2(raw)`), because the JSON file is
 * the database.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(
      'portfolio.json: expected a JSON object at the document root, received ' +
        (raw === null ? 'null' : Array.isArray(raw) ? 'an array' : typeof raw),
    );
  }

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  const supported: readonly number[] = SUPPORTED_SCHEMA_VERSIONS;

  if (typeof version !== 'number' || !supported.includes(version)) {
    throw new Error(
      `portfolio.json: unsupported schemaVersion ${JSON.stringify(version)}. ` +
        `This build supports schemaVersion ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}; ` +
        'add a migration step in src/content/loadContent.ts before bumping it.',
    );
  }

  return raw;
}

/** Validates (and migrates) an already-parsed document. Throws on any issue. */
export function validateContent(raw: unknown): Portfolio {
  const result = portfolioSchema.safeParse(migrate(raw));

  if (!result.success) {
    throw new Error(describeIssues(result.error));
  }

  return result.data;
}

let cached: Portfolio | undefined;

/**
 * The validated content. Imported once and memoised: the JSON cannot change at
 * runtime, and validation is only paid for on the first call.
 */
export function loadContent(): Portfolio {
  cached ??= validateContent(rawContent);
  return cached;
}
