/**
 * Asserts that a generation run actually landed in the bucket.
 *
 * A failing formatter hook is logged rather than thrown, so `gqlmd` can exit 0
 * with incomplete output. A pipeline that publishes documentation should check
 * what is in the destination instead of trusting the exit status.
 *
 * Usage: node scripts/verify-docs.ts [minimum]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPlatformProxy } from "wrangler";

import { HOMEPAGE_FILE } from "../src/lib/docs-layout.ts";
import { platformProxyOptions } from "../src/lib/platform-proxy.ts";

// `baseURL` is ".", so pages sit at the root of the bucket.
const PREFIX = "";
const minimum = Number(process.argv[2] ?? 200);

// Anchored to the project rather than to `process.cwd()`, so the script checks
// the same bucket wherever it is run from.
const projectDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { env, dispose } = await getPlatformProxy<Env>(
  platformProxyOptions(projectDir),
);

const keys: string[] = [];
let cursor: string | undefined;

do {
  const listed = await env.DOCS.list({ prefix: PREFIX, cursor, limit: 1000 });
  keys.push(...listed.objects.map(({ key }) => key));
  cursor = listed.truncated ? listed.cursor : undefined;
} while (cursor);

await dispose();

const homepageKey = `${PREFIX}${HOMEPAGE_FILE}`;

console.log(`${keys.length} objects under "${PREFIX}"`);

if (keys.length < minimum) {
  console.error(`Expected at least ${minimum}. The bucket looks incomplete.`);
  process.exit(1);
}

if (!keys.includes(homepageKey)) {
  console.error(`Missing ${homepageKey} — the homepage was not written.`);
  process.exit(1);
}

console.log("Documentation looks complete.");

// Same as generate-docs.ts: the binding's child process can outlive dispose().
process.exit(0);
