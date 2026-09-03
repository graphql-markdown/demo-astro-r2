/**
 * Runs GraphQL-Markdown, then releases the R2 binding.
 *
 * `gqlmd graphql-to-doc` would generate the same documentation from the same
 * `graphql.config.ts`, but the binding that config opens keeps a workerd
 * process alive, and nothing in a config file can tell when generation has
 * finished. This wrapper adds that one missing step.
 *
 * Usage: node scripts/generate-docs.ts [--force]
 */
import { runGraphQLMarkdown } from "@graphql-markdown/cli";

import { dispose } from "../graphql.config.ts";

const force = process.argv.includes("--force");

try {
  await runGraphQLMarkdown({}, { force });
} finally {
  await dispose();
}

// The proxy's child process can outlive `dispose()` briefly; the run is over,
// so do not wait on it.
process.exit(0);
