// @ts-nocheck
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import starlight from "@astrojs/starlight";
import catppuccin from "@catppuccin/starlight";

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
      sidebar: [
        {
          label: "Operations",
          items: [{ autogenerate: { directory: "operations" } }],
        },
        {
          label: "Types",
          items: [{ autogenerate: { directory: "types" } }],
        },
      ],
    }),
  ],
});
