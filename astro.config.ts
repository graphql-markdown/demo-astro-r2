import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import starlight from "@astrojs/starlight";
import catppuccin from "@catppuccin/starlight";

import { SECTIONS } from "./src/lib/docs-layout.ts";

// https://astro.build/config
export default defineConfig({
  // No `base`: @astrojs/cloudflare pins the Worker's asset root to the base
  // directory, so a base path and Cloudflare Workers do not mix.
  adapter: cloudflare({
    // Optimise images with sharp during the build, not at runtime.
    imageService: "compile",
  }),
  // Every page is prerendered from the bucket and nothing here uses sessions.
  // Left on, @astrojs/cloudflare wires up its default KV session driver on
  // every build, which expects a `SESSION` KV binding wrangler.jsonc does not
  // declare.
  session: false,
  // satteri's browser binding unconditionally imports its wasm32-wasi
  // fallback, which npm never installs (its package.json pins cpu:
  // ["wasm32"], an arch no real build machine reports), so the client
  // bundle step fails to resolve it. Starlight only needs satteri's
  // native binding at build time, so the browser fallback is dead code
  // here and safe to leave unresolved.
  //
  // Astro's static build builds the client bundle as its own Vite
  // environment and assembles its `build.rolldownOptions` as a literal
  // object (astro/dist/core/build/vite-build-config.js) that doesn't
  // inherit `external` from `vite.build` or `vite.environments.client`
  // config, so a plain config override never reaches it. A resolveId
  // hook runs independently of that config assembly, so mark the import
  // external there instead.
  vite: {
    plugins: [
      {
        name: "externalize-satteri-wasm32-wasi",
        resolveId(source) {
          if (source === "@bruits/satteri-wasm32-wasi") {
            return { id: source, external: true };
          }
        },
      },
    ],
  },
  integrations: [
    starlight({
      plugins: [catppuccin()],
      // The credit is replaced in src/components/Footer.astro.
      credits: false,
      pagination: false,
      // No `lastUpdated`: it reads git history for each page, and these pages
      // come from a bucket, not from this repository.
      title: "GraphQL-Markdown [R2 demo]",
      favicon: "/favicon.svg",
      // The project mark ships in two variants: its dark glyph disappears
      // against the dark theme's background.
      logo: {
        light: "./src/assets/graphql-markdown.svg",
        dark: "./src/assets/graphql-markdown-dark.svg",
      },
      customCss: ["./src/styles/custom.css"],
      components: {
        Footer: "./src/components/Footer.astro",
        PageTitle: "./src/components/PageTitle.astro",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/graphql-markdown/demo-astro-r2",
        },
      ],
      // One group per generated top-level directory, so the sidebar cannot
      // drift from what `npm run doc` writes to the bucket.
      sidebar: Object.entries(SECTIONS).map(([directory, label]) => ({
        label,
        items: [{ autogenerate: { directory } }],
      })),
    }),
  ],
});
