/**
 * Asserts that a generation run actually landed in the bucket.
 *
 * A failing formatter hook is logged rather than thrown, so `gqlmd` can exit 0
 * with incomplete output. A pipeline that publishes documentation should check
 * what is in the destination instead of trusting the exit status.
 *
 * Usage: node scripts/verify-docs.mjs [minimum]
 */
import { getPlatformProxy } from "wrangler";

// `baseURL` is ".", so pages sit at the root of the bucket.
const PREFIX = "";
const minimum = Number(process.argv[2] ?? 200);

const { env, dispose } = await getPlatformProxy({
  environment: process.env.WRANGLER_ENV,
});

const keys = [];
let cursor;

do {
  const listed = await env.DOCS.list({ prefix: PREFIX, cursor, limit: 1000 });
  keys.push(...listed.objects.map(({ key }) => key));
  cursor = listed.truncated ? listed.cursor : undefined;
} while (cursor);

await dispose();

const index = keys.includes(`${PREFIX}index.mdx`);

console.log(`${keys.length} objects under "${PREFIX}"`);

if (keys.length < minimum) {
  console.error(`Expected at least ${minimum}. The bucket looks incomplete.`);
  process.exit(1);
}

if (!index) {
  console.error(`Missing ${PREFIX}index.mdx — the homepage was not written.`);
  process.exit(1);
}

console.log("Documentation looks complete.");

// Same as generate-docs.mjs: the binding's child process can outlive dispose().
process.exit(0);
