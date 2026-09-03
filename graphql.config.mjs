import { getPlatformProxy } from "wrangler";

import { r2OutputAdapter } from "./src/lib/r2-output-adapter.mjs";

// Object keys are the generated paths relative to `rootPath`, so a page written
// to `docs/types/objects/user.mdx` is stored as `types/objects/user.mdx` and
// becomes the Starlight route `/types/objects/user`. Nothing is ever written to
// `docs/` — the path only decides the key.
const rootPath = "./docs";
const baseURL = ".";

// `getPlatformProxy` hands Node the same R2 binding the Worker gets. With no
// WRANGLER_ENV that is the local .wrangler state, so generation runs offline;
// WRANGLER_ENV=remote selects the wrangler.jsonc environment whose binding is
// marked `"remote": true` and writes to the real bucket instead.
const { env, dispose } = await getPlatformProxy({
  environment: process.env.WRANGLER_ENV,
});

// Miniflare keeps a workerd process alive behind the binding, so generation has
// to release it explicitly — `scripts/generate-docs.mjs` calls this when the
// run finishes. Nothing here can hook "generation ended" on its own, which is
// why `npm run doc` goes through that script rather than `gqlmd` directly.
export { dispose };

export default {
  schema: "https://graphql.anilist.co/",
  extensions: {
    ["graphql-markdown"]: {
      rootPath,
      baseURL,
      linkRoot: "/",
      homepage: "./assets/index.mdx",
      loaders: {
        UrlLoader: {
          module: "@graphql-tools/url-loader",
          options: { method: "POST" },
        },
      },
      // The Starlight preset with one override; see src/lib/formatter.mjs.
      formatter: new URL("./src/lib/formatter.mjs", import.meta.url).href,
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
