// @ts-nocheck
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // No `base`: @astrojs/cloudflare pins the Worker's asset root to the base
  // directory, so a base path and Cloudflare Workers do not mix.
  adapter: cloudflare({
    // Optimise images with sharp during the build, not at runtime.
    imageService: "compile",
  }),
});
