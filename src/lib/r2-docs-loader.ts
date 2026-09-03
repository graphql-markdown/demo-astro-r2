import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroConfig } from "astro";
import type { Loader } from "astro/loaders";
import { getPlatformProxy } from "wrangler";

import { platformProxyOptions } from "./platform-proxy.mjs";

/**
 * Pages fetched from R2 are staged here so Astro's MDX pipeline can compile
 * them. The Starlight formatter emits MDX — `<Badge>` and `<Aside>` imported
 * from `@astrojs/starlight/components` — and MDX needs a compiler, which Astro
 * reaches through a Vite import of a real file. `renderMarkdown()` would only
 * give us Markdown, so entries are marked `deferredRender` and pointed here
 * instead.
 *
 * It has to be Starlight's own collection directory, because Starlight derives
 * both the sidebar and `autogenerate` directory matching from `entry.filePath`
 * relative to it — staging anywhere else leaves the sidebar empty.
 *
 * The directory is a build artefact: gitignored, and rewritten from the bucket
 * on every load.
 *
 * Neither the collection name nor its directory is configurable: Starlight
 * hardcodes `<srcDir>/content/<collection>` in its own `getCollectionUrl()` and
 * `getCollectionPathFromRoot()` helpers, and those are not reachable through
 * its package exports, so the two forms below mirror them rather than import
 * them.
 *
 * @see node_modules/@astrojs/starlight/utils/collection.ts
 */
const COLLECTION = "docs";
const COLLECTION_DIR = `content/${COLLECTION}`;

const collectionPaths = ({ root, srcDir }: AstroConfig) => ({
  /** Absolute, for writing the staged files. */
  url: new URL(`${COLLECTION_DIR}/`, srcDir),
  /**
   * Relative to the project root, for `entry.filePath`. Starlight builds its
   * own collection path the same way, and matches the two against each other.
   */
  fromRoot: `${srcDir.pathname.replace(root.pathname, "")}${COLLECTION_DIR}`,
});

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const parseFrontMatter = (
  raw: string,
): { attributes: Record<string, string>; body: string } => {
  const match = raw.match(FRONT_MATTER);

  if (!match) {
    return { attributes: {}, body: raw };
  }

  const attributes: Record<string, string> = {};

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");

    if (separator > 0) {
      attributes[line.slice(0, separator).trim()] = line
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }

  return { attributes, body: raw.slice(match[0].length) };
};

/**
 * An Astro content loader backed by the same R2 bucket the GraphQL-Markdown
 * output adapter writes to.
 *
 * This runs at build time, under Node, which is why it can use Wrangler's
 * `getPlatformProxy()` to reach the binding: without WRANGLER_ENV it reads the
 * local .wrangler state, with `WRANGLER_ENV=remote` the real bucket.
 */
export const r2DocsLoader = (): Loader => ({
  name: "r2-docs",

  async load({
    config,
    store,
    parseData,
    renderMarkdown,
    generateDigest,
    logger,
  }) {
    const collection = collectionPaths(config);
    const { env, dispose } = await getPlatformProxy<Env>(
      platformProxyOptions(config.root),
    );

    try {
      store.clear();

      let cursor: string | undefined;
      let count = 0;

      do {
        const listed = await env.DOCS.list({ cursor, limit: 1000 });

        for (const { key } of listed.objects) {
          if (!key.endsWith(".mdx")) {
            continue;
          }

          const object = await env.DOCS.get(key);

          if (!object) {
            continue;
          }

          const raw = await object.text();
          const { attributes } = parseFrontMatter(raw);
          const id = key.replace(/\.mdx$/, "");

          const cached = fileURLToPath(new URL(key, collection.url));
          await mkdir(dirname(cached), { recursive: true });
          await writeFile(cached, raw, "utf8");

          store.set({
            id,
            filePath: `${collection.fromRoot}/${key}`,
            data: await parseData({
              id,
              data: { ...attributes, title: attributes.title ?? id },
            }),
            deferredRender: true,
            digest: generateDigest(raw),
          });

          count++;
        }

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      // Starlight's 404 route expects a `404` entry, which its own loader
      // supplies. Replacing the loader means supplying it here. It is plain
      // text, so it needs no MDX compilation and no cached file.
      store.set({
        id: "404",
        filePath: `${collection.fromRoot}/404.md`,
        data: await parseData({
          id: "404",
          data: {
            title: "404",
            template: "splash",
            editUrl: false,
            pagefind: false,
          },
        }),
        body: "",
        rendered: await renderMarkdown("This page could not be found."),
      });

      logger.info(`Loaded ${count} pages from R2`);
    } finally {
      // The proxy holds a workerd process open; the build has to let it go.
      await dispose();
    }
  },
});
