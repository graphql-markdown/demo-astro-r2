/**
 * A GraphQL-Markdown output adapter backed by Cloudflare R2.
 *
 * This is the whole point of the demo: it replaces the local filesystem as the
 * destination for generated documentation, so pages go straight into an R2
 * bucket and the Worker reads them back at request time.
 *
 * See https://graphql-markdown.dev/docs/advanced/output-adapter for the
 * contract the renderer expects.
 */
import path from "node:path";

/**
 * Builds the adapter for a bucket.
 *
 * @param bucket - An R2 binding, local or remote.
 * @param rootPath - The `rootPath` setting, used to turn paths into keys. Pass
 *   it absolute, as `graphql.config.ts` does, so the keys do not depend on the
 *   working directory the generator was started from.
 * @returns An object with `writeFile`, `readFile` and `ensureDir`.
 */
export const r2OutputAdapter = (bucket: R2Bucket, rootPath: string) => {
  /**
   * Keys are the generated paths relative to `rootPath`, always forward-slashed
   * so the same schema produces the same keys whichever OS generated them.
   *
   * Keying off `rootPath` rather than the output directory also keeps the
   * layout intact for the one file that sits outside it — mdBook's
   * `SUMMARY.md` — which would otherwise pick up a leading `..`.
   */
  const toKey = (location: string) =>
    path
      .relative(path.resolve(rootPath), path.resolve(location))
      .split(path.sep)
      .join("/");

  return {
    writeFile: async (filePath: string, content: string) => {
      await bucket.put(toKey(filePath), content, {
        httpMetadata: { contentType: "text/markdown; charset=utf-8" },
      });
    },

    /**
     * Required. Formatters that post-process their own output read each page
     * back; an absent object means "there is nothing here", which is a normal
     * answer rather than a failure.
     */
    readFile: async (filePath: string) => {
      const object = await bucket.get(toKey(filePath));

      return object ? await object.text() : undefined;
    },

    /**
     * R2 has no directories, so there is nothing to create. What matters is
     * honouring `forceEmpty`, which is what `--force` acts on: without it,
     * pages for types deleted from the schema would stay in the bucket forever.
     */
    ensureDir: async (dirPath: string, options?: { forceEmpty?: boolean }) => {
      if (options?.forceEmpty !== true) {
        return;
      }

      // Prefix matching is literal, not directory aware: without the trailing
      // delimiter, clearing `schema` would also clear `schema-v2/`. With this
      // demo's `baseURL: "."` the prefix is empty, so a forced run empties the
      // whole bucket — which is why it gets a bucket of its own.
      const dirKey = toKey(dirPath);
      const prefix = dirKey === "" ? "" : `${dirKey}/`;
      let cursor: string | undefined;

      do {
        const listed = await bucket.list({ prefix, cursor });

        if (listed.objects.length > 0) {
          await bucket.delete(listed.objects.map(({ key }) => key));
        }

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    },
  };
};
