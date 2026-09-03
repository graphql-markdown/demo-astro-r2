# GraphQL-Markdown + Cloudflare R2 demo

A demo of GraphQL-Markdown's [`outputAdapter`](https://graphql-markdown.dev/docs/settings#outputadapter)
setting: generated documentation is written **straight into a Cloudflare R2
bucket** instead of the local filesystem, and an
[Astro](https://astro.build/)/[Starlight](https://starlight.astro.build/) site
reads it back out of the bucket through a custom content loader.

No generated file ever touches the filesystem — not on the way in, not on the
way out.

```
   npm run doc                        R2 bucket                    npm run build
┌────────────────┐  outputAdapter  ┌──────────────┐ content loader ┌───────────┐
│ GraphQL schema │ ──────────────▶ │ **/*.mdx     │ ─────────────▶ │ Starlight │
└────────────────┘                 └──────────────┘                └───────────┘
```

Both ends run under Node: generation through Wrangler's
[`getPlatformProxy()`](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy),
the build through the same binding. Locally that is Wrangler's R2 emulation, so
the whole demo runs with no Cloudflare account.

## 🚀 Project structure

```
.
├── assets/
│   └── index.mdx                  # homepage template → index.mdx
├── src/
│   ├── content.config.ts          # points Starlight's docs collection at R2
│   ├── lib/
│   │   ├── r2-output-adapter.mjs  # ← the output adapter (generation)
│   │   ├── r2-docs-loader.ts      # ← the content loader (build)
│   │   └── formatter.mjs          # the Starlight preset, with overrides
│   ├── assets/                    # the project mark, light and dark variants
│   ├── components/
│   │   ├── Footer.astro           # Starlight's footer, crediting GraphQL-Markdown
│   │   └── PageTitle.astro        # adds breadcrumbs above the title
│   └── styles/custom.css          # theme tweaks (Starlight `customCss`)
├── public/favicon.svg             # the project mark
├── astro.config.ts
├── graphql.config.mjs             # wires the adapter into GraphQL-Markdown
├── scripts/
│   ├── generate-docs.mjs          # runs the generator, then releases the binding
│   └── verify-docs.mjs            # asserts the bucket actually holds the pages
├── package.json
└── wrangler.jsonc                 # the DOCS R2 binding
```

### How the pieces fit

**Generation** (`npm run doc`) runs under Node. `graphql.config.mjs` gets the R2
binding through Wrangler's `getPlatformProxy()` and hands it to
`r2OutputAdapter()`, which implements the three methods the renderer expects:

| Method | What it does here |
| :--- | :--- |
| `writeFile` | `bucket.put()` the page |
| `readFile` | `bucket.get()`, returning `undefined` when the object is absent |
| `ensureDir` | on `--force`, deletes every object under the prefix so pages for types dropped from the schema do not linger |

Object keys are the paths the filesystem writer would have used, relative to
`rootPath`: `docs/types/objects/user.mdx` becomes the key
`types/objects/user.mdx`.

`npm run doc` goes through `scripts/generate-docs.mjs` rather than calling
`gqlmd graphql-to-doc` directly. The two generate identical output, but the
binding keeps a workerd process alive and nothing inside a config file can tell
when generation has finished — so the script runs the generator and then
releases it. Calling `gqlmd` directly works, it just will not exit on its own.

**Rendering** is Starlight's. `src/content.config.ts` replaces Starlight's
`docsLoader()` — which reads `src/content/docs` off disk — with `r2DocsLoader()`,
which lists the bucket and stages each page for Astro to compile. Entry ids are
the keys minus `.mdx`, so `types/objects/user.mdx` becomes the route
`/types/objects/user`, which is exactly what the links inside the generated
pages point at.

This is a **build-time** read. Starlight prerenders every page, so regenerating
the documentation reaches the site through a rebuild and deploy — the `docs.yml`
workflow does both.

**MDX.** The demo uses the Starlight formatter, so pages arrive as MDX
importing `<Badge>` and `<Aside>` from `@astrojs/starlight/components`. MDX needs
a compiler, and Astro reaches it through a Vite import of a real file, so the
loader stages each page under `src/content/docs/` and marks the entry
`deferredRender` rather than calling `renderMarkdown()`. It has to be that
directory specifically: Starlight derives the sidebar and `autogenerate`
matching from `entry.filePath` relative to its own collection path, so staging
anywhere else builds fine but leaves the sidebar empty. The directory is a build
artefact — gitignored, and rewritten from the bucket on every load.

**Extending a preset.** `formatter` is a module path, so a preset can be
extended by re-exporting it and replacing the parts you want.

The Starlight preset already renders badges and admonitions as Starlight's own
`<Badge>` and `<Aside>` components. What it inherits from the shared defaults is
generic HTML carrying `gqlmd-mdx-*` classes, which only looks right if the site
ships CSS for those classes. `src/lib/formatter.mjs` overrides those to emit
elements Starlight already styles, so the markup needs no CSS to compensate —
what the generated content looks like is decided by the formatter, not patched
afterwards. (`src/styles/custom.css` is for theme tweaks that belong to the
site, such as the heading scale, not to the content.)

```js
export * from "@graphql-markdown/formatters/starlight";

/** ` · ` instead of the default ` ● `, as text rather than a styled span. */
export const formatMDXBullet = (text = "") => `&nbsp;·&nbsp;${text}`;

/** `Parent.field` as inline code, which Starlight styles. */
export const formatMDXNameEntity = (name, parentType) =>
  `<code>${parentType ? `${parentType}.` : ""}${name}</code>`;

// `createMDXFormatter` takes precedence over individual exports, so the
// overrides have to go through it too.
export const createMDXFormatter = (meta) => ({
  ...createStarlightFormatter(meta),
  formatMDXBullet,
  formatMDXNameEntity,
  formatMDXDetails,
});
```

### Breadcrumbs

[`astro-breadcrumbs`](https://docs.astro-breadcrumbs.kasimir.dev/) builds the
trail from `Astro.url.pathname`, which is the object key minus `.mdx`, so it
needs nothing threaded through from the loader. It is rendered from a
`PageTitle` override.

Two settings are worth noting. The intermediate segments are groupings rather
than pages — `/types/objects/user` exists, `/types/objects` does not — so their
`href` is dropped and they render as plain text. The BreadcrumbList JSON-LD goes
with them (`schemaJsonScript={false}`): it builds absolute URLs from every
crumb, so it both breaks on a crumb without one and would otherwise publish
structured data pointing at pages that do not exist.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command             | Action                                                       |
| :------------------ | :----------------------------------------------------------- |
| `npm install`       | Installs dependencies                                        |
| `npm run link:local`| Points GraphQL-Markdown at a local checkout (see below)       |
| `npm run doc`       | Generates documentation from the schema into R2              |
| `npm run doc:force` | Same, emptying the bucket first (`--force`)                  |
| `npm run doc:verify`| Checks that the bucket actually holds a complete set of pages |
| `npm run check`     | Regenerates binding types and type-checks the project        |
| `npm run dev`       | Starts the Astro dev server at `localhost:4321`              |
| `npm run build`     | Builds the Worker to `./dist/`                               |
| `npm run preview`   | Serves the built Worker locally with Wrangler                |
| `npm run deploy`    | Builds and deploys to Cloudflare Workers                     |

## 🏎️ Running the demo locally

Everything runs offline against Wrangler's local R2 emulation — no Cloudflare
account, no bucket, no credentials.

One prerequisite: `outputAdapter` is on GraphQL-Markdown's `main` branch but has
not been released to npm yet, so the generator comes from a local checkout of
the monorepo.

```bash
# 1. build graphql-markdown from a checkout next to this one
cd ../graphql-markdown
bun run build

# 2. install this demo
cd ../demo-astro-r2
npm install
npm run link:local   # copies that build over the npm-installed packages

# 3. generate the documentation into the local bucket (.wrangler/state)
npm run doc

# 4. serve it
npm run dev          # http://localhost:4321
```

`npm run link:local` looks for `../graphql-markdown` then `../../graphql-markdown`;
set `GRAPHQL_MARKDOWN_REPO` to point somewhere else. Delete the script and this
step once `outputAdapter` ships to npm.

Steps 1 and 2 are one-offs. After that:

| To... | Run |
| :--- | :--- |
| Regenerate after a schema or config change | `npm run doc` |
| Regenerate from scratch, dropping stale pages | `npm run doc:force` |
| Confirm the bucket holds a full set of pages | `npm run doc:verify` |
| Serve with hot reload | `npm run dev` |
| Serve the built Worker, as deployed | `npm run build && npm run preview` |
| Type-check | `npm run check` |

`npm run dev` and `npm run build` both read the same local bucket that
`npm run doc` wrote to. Because the pages are prerendered, regenerating means
rebuilding: restart `npm run dev`, or run `npm run build` again.

> 🧑‍🚀 **Edit `graphql.config.mjs` to try with your own GraphQL schema.**

### Troubleshooting

**The build produces only a 404 page.** The bucket is empty — run
`npm run doc` first. Check with `npm run doc:verify`, which should report 245
objects.

**The sidebar is empty.** The staged pages are not under `src/content/docs/`.
Starlight matches `autogenerate` directories against `entry.filePath` relative
to its collection path.

**`No such module "chunks/..."` when prerendering.** The staging directory name
must not start with a dot — it breaks the emitted chunk name.

**`format is not a function` during generation.** `@graphql-markdown/formatters`
is missing. It supplies the default renderers even when no `formatter` is set.

**`gqlmd graphql-to-doc` never exits.** Expected — use `npm run doc`, which
releases the R2 binding once generation is done. See above.

**The bucket looks stale.** `npm run doc` and `wrangler dev` share
`.wrangler/state`; stop the dev server, regenerate, then start it again.

### Using a real bucket

To generate into R2 proper rather than the local emulation:

```bash
npx wrangler login
npx wrangler r2 bucket create graphql-markdown-demo-docs
```

`wrangler.jsonc` already declares a `remote` environment whose `DOCS` binding is
marked `"remote": true`. Select it with `WRANGLER_ENV` to generate into the real
bucket:

```bash
WRANGLER_ENV=remote npm run doc
WRANGLER_ENV=remote npm run doc:verify
```

Leave `WRANGLER_ENV` unset and everything stays local.

## ☁️ Deploying

```bash
npx wrangler login
WRANGLER_ENV=remote npm run doc   # populate the bucket
WRANGLER_ENV=remote npm run deploy
```

## 🤖 CI/CD

Three workflows:

| Workflow | Trigger | What it does |
| :--- | :--- | :--- |
| `ci.yml` | pull requests, pushes to `main` | Generates against Wrangler's **local** R2 emulation, verifies it, then type-checks and builds — no bucket, no account, no secrets |
| `deploy.yml` | push to `main`, manual | Builds from whatever is in the bucket and deploys |
| `docs.yml` | manual | Regenerates into the real bucket with `WRANGLER_ENV=remote`, verifies, then builds and deploys |

Two things `docs.yml` has to be careful about:

- **`gqlmd` exits 0 even when a formatter hook failed**, so the run checks what
  actually landed in the bucket rather than trusting the exit status. That is
  what `npm run doc:verify` is for.
- **`--force` clears the prefix before writing**, so a run that dies halfway
  leaves the bucket partial. Verification turns that into a failed run rather
  than a quietly broken site; if that window is unacceptable, generate into a
  versioned prefix and swap only on success.

`docs.yml` should use a Cloudflare token scoped to write on this one bucket,
separately from the deployment token.

Because the loader reads R2 at build time, every workflow that builds needs read
access to the bucket, and a regeneration only reaches the site once `docs.yml`
has redeployed.

## 👀 Want to learn more?

- [Output Adapter guide](https://graphql-markdown.dev/docs/advanced/output-adapter)
- [`outputAdapter` setting](https://graphql-markdown.dev/docs/settings#outputadapter)
- [GraphQL-Markdown docs](https://graphql-markdown.dev/)
