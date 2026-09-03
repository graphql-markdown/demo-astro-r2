/**
 * `outputAdapter` is on graphql-markdown's main branch but not yet released,
 * so this demo runs against a local checkout of the monorepo: it copies the
 * built `dist` of each workspace package over the versions npm installed.
 *
 * Point GRAPHQL_MARKDOWN_REPO at your checkout (default: ../graphql-markdown),
 * run `bun run build` there first, then `npm run link:local` here.
 *
 * Remove this script once `outputAdapter` ships to npm.
 */
import { cp, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const exists = async (path) =>
  await stat(path).then(
    () => true,
    () => false,
  );

// `@graphql-markdown/types` is declarations only and ships no `dist`.
const packages = [
  "cli",
  "core",
  "formatters",
  "diff",
  "graphql",
  "helpers",
  "logger",
  "printer-legacy",
  "utils",
];

const candidates = process.env.GRAPHQL_MARKDOWN_REPO
  ? [process.env.GRAPHQL_MARKDOWN_REPO]
  : ["../graphql-markdown", "../../graphql-markdown"];

let repo;
for (const candidate of candidates) {
  if (await exists(resolve(candidate, "packages"))) {
    repo = resolve(candidate);
    break;
  }
}

if (!repo) {
  console.error(`No graphql-markdown checkout found (tried ${candidates.join(", ")}).`);
  console.error("Set GRAPHQL_MARKDOWN_REPO to your checkout.");
  process.exit(1);
}

console.log(`using ${repo}`);

for (const name of packages) {
  const from = join(repo, "packages", name, "dist");
  const to = join("node_modules", "@graphql-markdown", name, "dist");

  if (!(await exists(from))) {
    console.error(`Missing ${from} — run \`bun run build\` in ${repo}.`);
    process.exit(1);
  }

  if (!(await exists(join("node_modules", "@graphql-markdown", name)))) {
    console.log(`skip @graphql-markdown/${name} (not installed)`);
    continue;
  }

  await rm(to, { force: true, recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`linked @graphql-markdown/${name}`);
}
