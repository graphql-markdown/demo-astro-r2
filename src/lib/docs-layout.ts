/**
 * The layout of the generated documentation, in one place.
 *
 * Generation (`graphql.config.ts`), loading (`src/lib/r2-docs-loader.ts`),
 * rendering (`astro.config.ts`) and verification (`scripts/verify-docs.ts`) all
 * have to agree on where pages end up. `scripts/verify-docs.ts` cannot read any
 * of it from `graphql.config.ts` — importing that file opens an R2 binding as a
 * side effect, and the script already opens one of its own — so rather than
 * repeat the literals on each side, they live here.
 */

/**
 * The extension every generated page carries. The Starlight formatter emits
 * MDX, which is also what the loader stages for compilation.
 */
export const PAGE_EXTENSION = ".mdx";

/**
 * The homepage asset, under {@link ASSETS_DIR}. GraphQL-Markdown keys generated
 * pages by their path relative to `rootPath`, so the homepage lands in the
 * bucket under this same name — which is what verification looks for.
 */
export const HOMEPAGE_FILE = `index${PAGE_EXTENSION}`;

/** Where the homepage source lives, relative to the project root. */
export const ASSETS_DIR = "assets";

/**
 * The `rootPath` basename. Nothing is ever written to it — keys are paths
 * relative to it, so the name only decides how they are trimmed.
 */
export const ROOT_DIR = "docs";

/** The `baseURL` setting: pages sit at the root of the bucket. */
export const BASE_URL = ".";

/** The bucket prefix {@link BASE_URL} produces, and so what listing looks under. */
export const KEY_PREFIX = BASE_URL === "." ? "" : `${BASE_URL}/`;

/**
 * The Starlight content collection the pages are served as. Neither the name
 * nor its directory is configurable; see `src/lib/r2-docs-loader.ts`.
 */
export const COLLECTION = "docs";

/**
 * The top-level directories GraphQL-Markdown generates, and the sidebar group
 * each one is rendered as. A schema with no operations simply leaves its group
 * empty.
 */
export const SECTIONS: Record<string, string> = {
  operations: "Operations",
  types: "Types",
};
