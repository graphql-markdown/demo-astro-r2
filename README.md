# GraphQL-Markdown + Cloudflare R2 demo

**Live demo: <https://demo-astro-r2.edno.workers.dev/>**

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

## Markdown copies and deprecation links

Each page ends with a **View as Markdown** link to a plain Markdown copy, for
readers and tools that do not render MDX. `npm run doc` generates the pages into
R2, then runs `scripts/generate-copies.ts`, which writes the copies to the
`.markdown-copies` folder from the `markdown` project of `graphql.config.ts`
(`lib/markdown-copy.mjs` formatter, no output adapter). `npm run build` copies
them into `dist/client` after `astro build`, so `/types/objects/project.md` is
served next to `/types/objects/project`. The link is added by the formatter in
`src/lib/formatter.ts`, which reads and writes the page through the output
adapter.

The same formatter links type names written as inline code in deprecation
reasons (for example `ProjectStatus` on `Project.state`) to their pages, as in
the [hooks recipe](https://graphql-markdown.dev/docs/customize/hooks#link-entities-in-deprecation-reasons).

## Visual tests

`npm run doc:force && npm run build && npm run test:visual` screenshots the
landing page and one page per GraphQL type kind (desktop and mobile) with
Playwright; CI (`.github/workflows/visual.yml`) uploads them to Argos.

## 🚀 Project structure

```
.
├── assets/
│   └── index.mdx                  # landing page (splash template) → index.mdx
├── src/
│   ├── content.config.ts          # points Starlight's docs collection at R2
│   ├── lib/
│   │   ├── docs-layout.ts         # names shared by generation and verification
│   │   ├── r2-output-adapter.ts   # ← the output adapter (generation)
│   │   ├── r2-docs-loader.ts      # ← the content loader (build)
│   │   └── formatter.ts           # the Starlight preset, with overrides
│   ├── assets/                    # the project mark, light and dark variants
│   ├── components/
│   │   ├── Footer.astro           # Starlight's footer, crediting GraphQL-Markdown
│   │   └── PageTitle.astro        # adds breadcrumbs above the title
│   └── styles/custom.css          # theme tweaks (Starlight `customCss`)
├── public/favicon.svg             # the project mark
├── astro.config.ts
├── graphql.config.ts              # wires the adapter into GraphQL-Markdown
├── scripts/
│   ├── generate-docs.ts           # runs the generator, then releases the binding
│   └── verify-docs.ts             # asserts the bucket actually holds the pages
├── tests/visual/site.spec.ts      # Playwright + Argos screenshots
├── playwright.config.ts           # serves dist/client on VISUAL_PORT (4173)
├── package.json
└── wrangler.jsonc                 # the DOCS R2 binding
```

### How the pieces fit

**Generation** (`npm run doc`) runs under Node. `graphql.config.ts` gets the R2
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

`npm run doc` goes through `scripts/generate-docs.ts` rather than calling
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
the documentation reaches the site through a rebuild and deploy — the `deploy.yml`
workflow does all three on every merge to `main`.

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
ships CSS for those classes. `src/lib/formatter.ts` overrides those to emit
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

```bash
# 1. install this demo
npm install

# 2. generate the documentation into the local bucket (.wrangler/state)
npm run doc

# 3. serve it
npm run dev          # http://localhost:4321
```

Step 1 is a one-off. After that:

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

> 🧑‍🚀 **Edit `graphql.config.ts` to try with your own GraphQL schema.**

### Troubleshooting

**The build produces only a 404 page.** The bucket is empty — run
`npm run doc` first. Check with `npm run doc:verify`, which should report 35
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

Two workflows:

| Workflow | Trigger | What it does |
| :--- | :--- | :--- |
| `ci.yml` | pull requests, and called by `deploy.yml` | Generates against Wrangler's **local** R2 emulation, verifies it, then type-checks and builds — no bucket, no account, no secrets |
| `deploy.yml` | push to `main`, manual | Runs `ci.yml` as a gate, then regenerates into the real bucket with `WRANGLER_ENV=remote`, verifies it, builds from it and deploys |

Run `deploy.yml` manually to pick up a change to the shared demo schema, which
is served from the graphql-markdown repository, without a commit here.

`deploy.yml` calls `ci.yml` rather than letting it trigger on the same push:
run as two workflows they go in parallel, and nothing stops a commit that fails
the checks from shipping — the deploy's own `npm run build` catches a broken
build, but `astro build` only strips types, so `astro check` has to be a gate
in front of it rather than a race beside it.

Two things the regeneration in `deploy.yml` has to be careful about:

- **`gqlmd` exits 0 even when a formatter hook failed**, so the run checks what
  actually landed in the bucket rather than trusting the exit status. That is
  what `npm run doc:verify` is for.
- **`--force` clears the prefix before writing**, so a run that dies halfway
  leaves the bucket partial. Verification turns that into a failed run rather
  than a quietly broken site; if that window is unacceptable, generate into a
  versioned prefix and swap only on success.

The deploy job holds an `r2-bucket` concurrency group, so two runs never
overlap: one cannot build from the bucket while another has it half-written.
Runs queue rather than cancel, because a cancelled run would leave the bucket
partial. Only the deploy job holds the group, so the `ci.yml` checks in front of
it, which never touch the bucket, do not keep a queued run waiting.

### Token permissions

Both tokens need **Workers Scripts: Edit**, which is less obvious than it
sounds. Writing through a `remote: true` binding does not talk to R2 directly:
`getPlatformProxy()` opens a Workers edge-preview session and proxies the
binding through it, so the call that authenticates is
`/accounts/<id>/workers/subdomain/edge-preview`, not an R2 endpoint. A token
holding only **Workers R2 Storage** fails there with
`RemoteSessionAuthenticationError` before it ever reaches the bucket.

| Secret | Used by | Permissions |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | `deploy.yml` (deploy step) | Workers Scripts: Edit + Workers R2 Storage: Read |
| `CLOUDFLARE_R2_API_TOKEN` | `deploy.yml` (generate, verify, build) | Workers Scripts: Edit + Workers R2 Storage: Edit |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml` | not a credential — it appears in every dashboard URL |

So the second token is only narrower in its R2 scope, which you can still limit
to this one bucket. It is **not** a lower-privilege token overall: `Workers
Scripts: Edit` lets it deploy Workers too. Keep the split if you want the
bucket restriction, but do not rely on it as a privilege boundary.

Because the loader reads R2 at build time, every workflow that builds needs read
access to the bucket, and a regeneration only reaches the site once `deploy.yml`
has rebuilt and redeployed.

## 👀 Want to learn more?

- [Output Adapter guide](https://graphql-markdown.dev/docs/advanced/output-adapter)
- [`outputAdapter` setting](https://graphql-markdown.dev/docs/settings#outputadapter)
- [GraphQL-Markdown docs](https://graphql-markdown.dev/)
