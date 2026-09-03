/**
 * Shared `getPlatformProxy()` options, anchored to the project.
 *
 * Three entry points reach the `DOCS` binding from Node — the content loader,
 * `graphql.config.ts` and `scripts/verify-docs.ts` — and all three need the
 * same anchoring: left to their defaults, `getPlatformProxy()` searches upwards
 * from `process.cwd()` for the config file and reads the local state from a
 * `.wrangler` beside it, so a run started from elsewhere gets no `DOCS`
 * binding, or an empty one.
 *
 * Neither name below is exported by Wrangler: `wrangler.jsonc` is this
 * project's choice among the config filenames Wrangler accepts, and
 * `.wrangler/state/v3` mirrors the default `persist` path its CLI uses, which
 * is documented but not published as a constant.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_FILE = "wrangler.jsonc";
const STATE_DIR = path.join(".wrangler", "state", "v3");

/**
 * @param projectDir - The project root, absolute. Astro hands it over as a URL
 *   (`config.root`); the scripts derive it from `import.meta.url`.
 * @returns Options to spread into `getPlatformProxy()`. `WRANGLER_ENV=remote`
 *   selects the wrangler.jsonc environment whose `DOCS` binding is marked
 *   `"remote": true`; unset, everything runs against the local state.
 */
export const platformProxyOptions = (projectDir: string | URL) => {
  const root =
    projectDir instanceof URL ? fileURLToPath(projectDir) : projectDir;

  return {
    configPath: path.join(root, CONFIG_FILE),
    persist: { path: path.join(root, STATE_DIR) },
    environment: process.env.WRANGLER_ENV,
  };
};
