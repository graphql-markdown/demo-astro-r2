// Decorators shared by both outputs (the pages and the Markdown copies).
import {
  directiveOccurrence,
  hasDirectiveNamed,
} from "@graphql-markdown/graphql";
import type { Decorators } from "@graphql-markdown/types";

export const decorators: Decorators = {
  // Mirrors the built-in `@deprecated` treatment (badge + callout) for the
  // type-level `@deprecatedType` directive, which the spec doesn't allow
  // `@deprecated` to target.
  deprecatedTypeTag: {
    predicate: hasDirectiveNamed("deprecatedType"),
    position: { into: "tags" },
    render: (_values, options) =>
      options.formatMDXBadge?.({ text: "deprecated" }),
  },
  deprecatedTypeNotice: {
    predicate: hasDirectiveNamed("deprecatedType"),
    position: { into: "description" },
    resolve: directiveOccurrence("deprecatedType"),
    render: ([value], options) =>
      options.formatMDXAdmonition?.(
        { text: String(value.reason), title: "Deprecated", type: "warning" },
        options.meta,
      ),
  },
};
