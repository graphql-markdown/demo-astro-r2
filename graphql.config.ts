import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPlatformProxy } from "wrangler";

import {
  ASSETS_DIR,
  BASE_URL,
  HOMEPAGE_FILE,
  ROOT_DIR,
} from "./src/lib/docs-layout.ts";
import { decorators } from "./src/lib/decorators.ts";
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

// The schema shared by all GraphQL-Markdown demos, served from the main
// repository.
const schema =
  "https://raw.githubusercontent.com/graphql-markdown/graphql-markdown/main/tests/e2e/__data__/demo_schema.graphql";

// Content settings shared by the pages and their Markdown copies.
const loaders = {
  UrlLoader: "@graphql-tools/url-loader",
};
const printTypeOptions = {
  typeBadges: true,
};

// Formatter paths must be absolute: a relative path is not resolved from the
// project folder.
const local = (file: string) => new URL(file, import.meta.url).href;

export default {
  projects: {
    default: {
      schema,
      extensions: {
        ["graphql-markdown"]: {
          rootPath,
          baseURL: BASE_URL,
          linkRoot: "/",
          homepage: path.join(configDir, ASSETS_DIR, HOMEPAGE_FILE),
          loaders,
          decorators,
          // The Starlight preset with overrides and the deprecation and
          // Markdown copy links; see src/lib/formatter.ts.
          formatter: local("./src/lib/formatter.ts"),
          docOptions: {
            sectionHeaderId: false,
          },
          printTypeOptions,
          outputAdapter: r2OutputAdapter(env.DOCS, rootPath),
          // Demo builds should not send anonymous usage telemetry.
          telemetry: false,
        },
      },
    },
    // Plain Markdown copies, written to disk (no adapter) and published next to
    // each page by `npm run build`; see scripts/generate-copies.ts.
    markdown: {
      schema,
      extensions: {
        ["graphql-markdown"]: {
          rootPath: path.join(configDir, ".markdown-copies"),
          // Same as the pages, so a copy has the path of its page
          baseURL: BASE_URL,
          loaders,
          decorators,
          printTypeOptions,
          formatter: local("./lib/markdown-copy.mjs"),
          // The homepage is a page of the site, not a schema entity
          homepage: false,
          // No `{#id}` heading IDs, which plain Markdown does not support
          docOptions: { sectionHeaderId: false },
          telemetry: false,
          force: true,
        },
      },
    },
  },
};
