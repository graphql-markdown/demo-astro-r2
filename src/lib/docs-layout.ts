/**
 * Names shared by generation and verification.
 *
 * `scripts/verify-docs.ts` cannot read these from `graphql.config.ts`: importing
 * that file opens an R2 binding as a side effect, and the script already opens
 * one of its own. Rather than repeat the literals on both sides, they live here.
 */

/**
 * The homepage asset, under `assets/`. GraphQL-Markdown keys generated pages by
 * their path relative to `rootPath`, so the homepage lands in the bucket under
 * this same name — which is what verification looks for.
 */
export const HOMEPAGE_FILE = "index.mdx";
