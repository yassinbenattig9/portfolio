import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { portfolioSchema, type Portfolio } from '../src/content/schema.ts';

/**
 * Helpers shared by `validate-content.ts` and `build-plain.ts`.
 *
 * Both scripts run under `node --experimental-strip-types` (no bundler), so
 * this file may only use erasable TypeScript syntax and explicit `.ts`
 * extensions on relative imports. The content modules are NOT imported
 * statically: they go through Vite's SSR loader, because
 * `src/content/loadContent.ts` uses extensionless imports and a bare JSON
 * import that Node's resolver does not accept. Loading them through Vite keeps
 * `validateContent` as the single source of validation for the whole pipeline
 * (tests, runtime, plain page, build gate).
 *
 * One exception: `src/content/schema.ts` (only bare imports, no extensions
 * problem) IS imported statically, so the asset-path whitelist below can be
 * derived from `portfolioSchema` instead of a hand-copied list.
 */

export const DEFAULT_CONTENT_PATH = 'src/content/portfolio.json';

export interface ContentLoader {
  loadContentModule(): Promise<{
    validateContent: (raw: unknown) => Portfolio;
    deriveSpreads: (content: Portfolio) => ReadonlyArray<unknown>;
  }>;
  /** Resolves a JSON value from the given (or the default) content path. */
  readRawJson(contentPath?: string): Promise<unknown>;
  close(): Promise<void>;
}

/** Starts a headless Vite SSR server without the project's dev plugins. */
export async function createContentLoader(): Promise<ContentLoader> {
  const server: ViteDevServer = await createServer({
    // The scripts only run TS/JSON through SSR; plugins and the vitest config
    // are not needed, so skip the config file entirely.
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true },
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });

  return {
    async loadContentModule() {
      const loadContentModule = await server.ssrLoadModule('/src/content/loadContent.ts');
      const deriveSpreadsModule = await server.ssrLoadModule('/src/content/deriveSpreads.ts');
      return {
        validateContent: loadContentModule.validateContent as (
          raw: unknown,
        ) => Portfolio,
        deriveSpreads: deriveSpreadsModule.deriveSpreads as (
          content: Portfolio,
        ) => ReadonlyArray<unknown>,
      };
    },
    async readRawJson(contentPath?: string) {
      const path = resolveJsonPath(contentPath);
      let text: string;
      try {
        text = await readFile(path, 'utf8');
      } catch (cause) {
        throw new Error(`content file not readable: ${path} (${(cause as Error).message})`);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch (cause) {
        throw new Error(`${path} is not valid JSON: ${(cause as Error).message}`);
      }
    },
    close: () => server.close(),
  };
}

function resolveJsonPath(contentPath?: string): string {
  const raw = contentPath ?? process.env.PORTFOLIO_JSON ?? DEFAULT_CONTENT_PATH;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

/**
 * The fields whose string values are asset references that must exist under
 * `public/`. Derived from the schema itself: `deriveAssetPathPatterns` walks
 * `portfolioSchema` and keeps every string field that carries the schema's
 * `mediaPath` rule (`startsWith("/media/")` in src/content/schema.ts). Array
 * elements are recorded as `*`. For the current schema:
 *
 *   contact.cv
 *   projects.*.right.demo.poster
 *   projects.*.right.demo.src
 *
 * Deriving instead of hand-copying keeps the gate in sync with the schema
 * automatically (a new `mediaPath` field is checked, a field once removed
 * stops being checked), and free-text fields can no longer fail the media
 * check by coincidence: only whitelisted fields are ever inspected.
 */
let assetPathPatterns: readonly string[] | undefined;

function getAssetPathPatterns(): readonly string[] {
  return (assetPathPatterns ??= deriveAssetPathPatterns(portfolioSchema));
}

export interface AssetPathRef {
  readonly fieldPath: string;
  readonly value: string;
}

/** Collects every string value with its field path; the whitelist decides which must exist on disk. */
export function collectAssetPaths(value: unknown, path: string): AssetPathRef[] {
  if (typeof value === 'string') {
    return [{ fieldPath: path, value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectAssetPaths(item, `${path}[${index}]`),
    );
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      collectAssetPaths(child, path.length === 0 ? key : `${path}.${key}`),
    );
  }
  return [];
}

/** Returns the missing files, checked against `public/`. */
export async function findMissingAssets(
  content: Portfolio,
  publicDir: string,
): Promise<AssetPathRef[]> {
  return collectAssetPaths(content, '').filter(
    ({ fieldPath, value }) => isWhitelistedField(fieldPath) && !existsSync(resolve(publicDir, value.slice(1))),
  );
}

/** True when the field path matches a whitelist pattern (`*` = array element). */
function isWhitelistedField(fieldPath: string): boolean {
  // `projects[0].right.demo.poster` and `projects.*.right.demo.poster` must
  // line up segment by segment.
  const segments = fieldPath.replace(/\[\d+\]/g, '.*').split('.');
  return getAssetPathPatterns().some((pattern) => matchSegments(segments, pattern.split('.')));
}

function matchSegments(segments: readonly string[], pattern: readonly string[]): boolean {
  return (
    segments.length === pattern.length &&
    segments.every((segment, index) => pattern[index] === '*' || pattern[index] === segment)
  );
}

/**
 * Structural subset of Zod's schema nodes, enough to walk a schema without
 * depending on zod's public API surface. If zod's internals change shape,
 * `deriveAssetPathPatterns` fails loudly instead of silently under-checking.
 */
interface SchemaNode {
  readonly _zod?: {
    readonly def?: {
      readonly type?: string;
      readonly shape?: Readonly<Record<string, SchemaNode>>;
      readonly options?: readonly SchemaNode[];
      readonly element?: SchemaNode;
      readonly innerType?: SchemaNode;
      readonly checks?: ReadonlyArray<{
        readonly _zod?: {
          readonly def?: {
            readonly format?: string;
            readonly prefix?: unknown;
          };
        };
      }>;
    };
  };
}

/** A string carrying the schema's `mediaPath` rule: starts with "/media/". */
function isMediaPathSchema(node: SchemaNode): boolean {
  return (node._zod?.def?.checks ?? []).some(
    (check) =>
      check._zod?.def?.format === 'starts_with' && check._zod?.def?.prefix === '/media/',
  );
}

/**
 * Walks a Zod schema and returns the dotted field paths of every string
 * field with the `mediaPath` rule. Throws on node kinds it does not know, so
 * new schema constructs force an update to this walker rather than skipping
 * the media check for that field.
 */
function deriveAssetPathPatterns(schema: unknown): readonly string[] {
  const patterns: string[] = [];

  function walk(node: SchemaNode, path: string): void {
    const def = node._zod?.def;
    if (!def) {
      throw new Error(`cannot derive asset paths from the schema at "${path || 'root'}": unknown node shape (zod internals changed?)`);
    }
    if (def.type === 'optional' || def.type === 'nullable') {
      return walk(def.innerType ?? {}, path);
    }
    if (def.type === 'union') {
      return (def.options ?? []).forEach((option) => walk(option, path));
    }
    if (def.type === 'object') {
      for (const [key, child] of Object.entries(def.shape ?? {})) {
        walk(child, path.length === 0 ? key : `${path}.${key}`);
      }
      return;
    }
    if (def.type === 'array') {
      return walk(def.element ?? {}, path.length === 0 ? '*' : `${path}.*`);
    }
    if (def.type === 'string') {
      if (isMediaPathSchema(node)) patterns.push(path);
      return;
    }
    // literal / boolean / enum / ... carry no asset paths.
  }

  walk(schema as SchemaNode, '');
  return Array.from(new Set(patterns));
}

/** Escapes text for safe interpolation into HTML text and attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
