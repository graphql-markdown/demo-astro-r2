/**
 * Generates the Markdown copies of the pages into `.markdown-copies`.
 *
 * Runs in its own process, after `generate-docs.ts`: the printer keeps the
 * first run's formatter within a process, so a second run there would reuse the
 * Starlight preset. The `markdown` project of `graphql.config.ts` writes to
 * disk, with no output adapter, but loading the config still opens the R2
 * binding, which has to be released.
 *
 * Usage: node scripts/generate-copies.ts
 */
import { rmSync } from "node:fs";

import { runGraphQLMarkdown } from "@graphql-markdown/cli";

import { dispose } from "../graphql.config.ts";

rmSync("./.markdown-copies", { force: true, recursive: true });

try {
  await runGraphQLMarkdown({ id: "markdown" }, {});
} finally {
  await dispose();
}

console.log("Markdown copies generated in .markdown-copies");
process.exit(0);
