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

import { createMDXFormatter as createStarlightFormatter } from "@graphql-markdown/formatters/starlight";

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
});
