import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPlatformProxy } from "wrangler";

import {
  ASSETS_DIR,
  BASE_URL,
  HOMEPAGE_FILE,
  ROOT_DIR,
} from "./src/lib/docs-layout.ts";
import { platformProxyOptions } from "./src/lib/platform-proxy.ts";
import { r2OutputAdapter } from "./src/lib/r2-output-adapter.ts";

// Paths are anchored to this file rather than left relative, so a run from
// another working directory generates the same keys instead of quietly
// rebasing them on `process.cwd()`.
const configDir = path.dirname(fileURLToPath(import.meta.url));

// Object keys are the generated paths relative to `rootPath`, so a page written
// to `docs/types/objects/user.mdx` is stored as `types/objects/user.mdx` and
// becomes the Starlight route `/types/objects/user`.
const rootPath = path.join(configDir, ROOT_DIR);

// `getPlatformProxy` hands Node the same R2 binding the Worker gets. With no
// WRANGLER_ENV that is the local .wrangler state, so generation runs offline;
// WRANGLER_ENV=remote selects the wrangler.jsonc environment whose binding is
// marked `"remote": true` and writes to the real bucket instead.
const { env, dispose } = await getPlatformProxy<Env>(
  // Anchored like the paths above, for the reasons `platformProxyOptions()`
  // spells out.
  platformProxyOptions(configDir),
);

// Miniflare keeps a workerd process alive behind the binding, so generation has
// to release it explicitly — `scripts/generate-docs.ts` calls this when the
// run finishes. Nothing here can hook "generation ended" on its own, which is
// why `npm run doc` goes through that script rather than `gqlmd` directly.
export { dispose };

export default {
  schema: "https://graphql.anilist.co/",
  extensions: {
    ["graphql-markdown"]: {
      rootPath,
      baseURL: BASE_URL,
      linkRoot: "/",
      homepage: path.join(configDir, ASSETS_DIR, HOMEPAGE_FILE),
      loaders: {
        UrlLoader: {
          module: "@graphql-tools/url-loader",
          options: { method: "POST" },
        },
      },
      // The Starlight preset with one override; see src/lib/formatter.ts.
      formatter: new URL("./src/lib/formatter.ts", import.meta.url).href,
      docOptions: {
        sectionHeaderId: false,
      },
      printTypeOptions: {
        typeBadges: true,
      },
      outputAdapter: r2OutputAdapter(env.DOCS, rootPath),
    },
  },
};
