import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";

import { r2DocsLoader } from "./lib/r2-docs-loader";

export const collections = {
  // Starlight's own `docsLoader()` reads `src/content/docs` off disk. This one
  // reads the same pages out of the R2 bucket the output adapter wrote them to,
  // so no generated file ever touches the filesystem.
  docs: defineCollection({ loader: r2DocsLoader(), schema: docsSchema() }),
};
