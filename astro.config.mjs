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
  integrations: [
    starlight({
      plugins: [catppuccin()],
      credits: true,
      pagination: false,
      // No `lastUpdated`: it reads git history for each page, and these pages
      // come from a bucket, not from this repository.
      title: "GraphQL-Markdown [R2 demo]",
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
