# Documentation site maintenance

The public site is built from the authored Markdown under `docs/` with
VitePress. `docs/.vitepress/published-pages.mjs` is the explicit page allowlist;
navigation and sidebar groups live in `docs/.vitepress/config.mts`. Other
Markdown, including plans, reviews, handoffs, routing fixtures, and smoke-test
records, stays repository-only. Do not add a page without assigning its owner
and navigation location.

## Content ownership

| Page | Canonical content |
| --- | --- |
| `index.md`, `getting-started.md` | Site discovery and first steps |
| `setup.md` | Canonical installation by client |
| `guides/model-routing.md`, `guides/troubleshooting.md` | Focused help; legacy setup anchors link here |
| `skills/work/index.md`, `skills/review/index.md`, `skills/autonomous/index.md` | User-facing workflow explanations |
| `skills/source-code-lookup/index.md`, `skills/pull-request-description/index.md` | Supporting skill explanations |
| `architecture.md`, `runtime-compatibility.md` | Canonical architecture and runtime status |
| `contributing.md` | Entry point to root `CONTRIBUTING.md` |
| `site-maintenance.md` | Site ownership, build, and publishing guidance |

Skill pages explain what users can expect; behavior remains authoritative in
the linked skill sources. Read those sources before changing explanations. If
workflow behavior changes, update the relevant skill page and links in this
ownership map as part of the same documentation change.

Prefer relative `.md` links between published docs pages so both the source
tree and VitePress resolve them. For a repository-only source, link to its
canonical GitHub URL. Keep a direct published page path working; the build
check validates output pages, internal links, fragments, assets, and the
`/AgenticAle/` base.

## Local build and preview

Use Node.js 24 or later from a checkout:

```sh
npm ci
npm run docs:dev
npm run docs:check
npm run docs:preview
```

The development server serves source changes directly. `docs:check` builds the
site and checks the generated HTML. After changing source and running a new
build, restart an existing preview process so it reads the rebuilt output.
Build output remains under `docs/.vitepress/dist/` and is intentionally kept
available for local preview.

## GitHub Pages

The repository workflow builds and checks the site on pull requests and merge
groups. A successful push to `main` deploys the same built artifact. A manual
run can deploy only when started from `main`; pull request runs never publish.
The workflow uses the `github-pages` environment and grants deployment
permissions only to its deploy job.

One-time repository setup: open **Settings → Pages**, set **Build and
deployment → Source** to **GitHub Actions**, and save. A public update appears
only after its change is merged to `main` and the deployment workflow succeeds.
This repository change configures the workflow; it does not itself publish a
live site.
