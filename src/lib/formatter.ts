/**
 * The Starlight preset, with the parts that are not Starlight-native replaced.
 *
 * A `formatter` is just a module, so a preset can be extended by re-exporting
 * it and overriding what you want. The preset already renders badges and
 * admonitions as Starlight's own `<Badge>` and `<Aside>` components; what it
 * inherits from the shared defaults is generic HTML carrying `gqlmd-mdx-*`
 * classes, which only looks right if the site ships CSS for those classes.
 *
 * The overrides below emit plain elements Starlight already styles instead, so
 * this demo needs no stylesheet of its own.
 */
export * from "@graphql-markdown/formatters/starlight";

import { readFile, writeFile } from "node:fs/promises";
import { relative, sep } from "node:path";

import * as preset from "@graphql-markdown/formatters/starlight";
import { createMDXFormatter as createStarlightFormatter } from "@graphql-markdown/formatters/starlight";
import { toLink } from "@graphql-markdown/printer-legacy";

/**
 * The contract each override has to satisfy, taken from the preset being
 * extended rather than from `@graphql-markdown/types`, which this project does
 * not depend on directly.
 */
type StarlightFormatter = ReturnType<typeof createStarlightFormatter>;

/**
 * The renderer brands formatter output as an opaque `MDXString`. Template
 * literals produce a plain `string`, so each override asserts the brand on the
 * way out; the parameter types are still checked against the contract.
 */
type MDXString = ReturnType<StarlightFormatter["formatMDXBullet"]>;

/** ` · ` instead of the default ` ● `, as text rather than a styled span. */
export const formatMDXBullet: StarlightFormatter["formatMDXBullet"] = (
  text = "",
) => `&nbsp;·&nbsp;${text}` as MDXString;

/** `Parent.field` as inline code, which Starlight styles. */
export const formatMDXNameEntity: StarlightFormatter["formatMDXNameEntity"] = (
  name,
  parentType,
) => `<code>${parentType ? `${parentType}.` : ""}${name}</code>` as MDXString;

/** A plain `<details>`, which Starlight styles inside Markdown content. */
export const formatMDXDetails: StarlightFormatter["formatMDXDetails"] = ({
  dataOpen,
  dataClose,
}) =>
  `\n\n<details>\n<summary>${dataOpen}</summary>\n\n\r\n\n<em>${dataClose}</em>\n</details>\n\n` as MDXString;

/**
 * `createMDXFormatter` takes precedence over individually exported functions,
 * so the overrides have to go through it as well as being exported above.
 */
export const createMDXFormatter = (
  meta?: Parameters<typeof createStarlightFormatter>[0],
): StarlightFormatter => ({
  ...createStarlightFormatter(meta),
  formatMDXBullet,
  formatMDXNameEntity,
  formatMDXDetails,
  formatMDXAdmonition,
});

// Links schema type names written as inline code in deprecation reasons to
// their pages, following the "Link entities in deprecation reasons" recipe:
// https://graphql-markdown.dev/docs/customize/hooks#link-entities-in-deprecation-reasons

// Pages render concurrently, so this may hold another page's options: only read
// settings shared by every page (schema, basePath, hierarchy, groups, deprecated, formatMDXLink).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let printOptions: any;

/** Captures the resolved print options before each page is printed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const beforePrintTypeHook = (event: any) => {
  printOptions = event.data.options;
};

/** Replaces inline code names matching a schema type with a link to its page. */
const linkEntities = (text: string): string => {
  const schema = printOptions?.schema;
  const rootTypes = [
    schema?.getQueryType(),
    schema?.getMutationType(),
    schema?.getSubscriptionType(),
  ];

  return text.replaceAll(
    /`([_A-Za-z][_0-9A-Za-z]*)`/g,
    (match: string, name: string) => {
      const type = schema?.getType(name);
      if (!type || name.startsWith("__") || rootTypes.includes(type)) {
        return match;
      }
      const { url } = toLink(type, name, undefined, printOptions);
      return url === "#" ? match : `[\`${name}\`](${url})`;
    },
  );
};

/**
 * Links entities in deprecation admonitions, whatever the title case, so the
 * `@deprecatedType` notices (titled "Deprecated") are linked too.
 */
export const formatMDXAdmonition = ((admonition: any, meta: any) => {
  const text =
    admonition.title?.toLowerCase() === "deprecated" && admonition.text
      ? linkEntities(admonition.text)
      : admonition.text;
  return (preset.formatMDXAdmonition as any)({ ...admonition, text }, meta);
}) as StarlightFormatter["formatMDXAdmonition"];

// Public URL of the generated pages' folder (site URL + base path + baseURL);
// the Markdown copies are published next to the pages.
const COPIES_URL = "https://demo-astro-r2.edno.workers.dev";

/**
 * Appends a "View as Markdown" link to each page, pointing to its copy. The
 * page lives in the R2 bucket, so it is read and written through the output
 * adapter.
 */
export const afterRenderTypeEntitiesHook = async (event: any) => {
  // Keep the preset's own hook, if any
  await (preset as any).afterRenderTypeEntitiesHook?.(event);

  const { filePath, outputDir, outputAdapter } = event.data;
  const route = relative(outputDir, filePath)
    .split(sep)
    .join("/")
    .replace(/\.mdx?$/, "");
  const link = `\n\n[View as Markdown](${COPIES_URL}/${route}.md)\n`;

  const page: string | undefined = outputAdapter?.readFile
    ? await outputAdapter.readFile(filePath)
    : await readFile(filePath, "utf8");
  const content = `${(page ?? "").trimEnd()}${link}`;
  await (outputAdapter?.writeFile
    ? outputAdapter.writeFile(filePath, content)
    : writeFile(filePath, content));
};
