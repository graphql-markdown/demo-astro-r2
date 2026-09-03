import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";

import { COLLECTION } from "./lib/docs-layout";
import { r2DocsLoader } from "./lib/r2-docs-loader";

export const collections = {
  // Starlight's own `docsLoader()` reads `src/content/docs` off disk. This one
  // reads the same pages out of the R2 bucket the output adapter wrote them to,
  // so no generated file ever touches the filesystem.
  [COLLECTION]: defineCollection({
    loader: r2DocsLoader(),
    schema: docsSchema(),
  }),
};
