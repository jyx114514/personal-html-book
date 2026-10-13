# Maintenance and Verification Guide

[Project overview](../README.en.md) · [Authoring and build](authoring.en.md)

Keep the README focused on project purpose, getting started, limitations, and documentation links. Authoring procedures belong in the authoring guide, engineering details here, and task-specific review records in `internal/`.

<!-- readme-section: dependencies -->
## Dependencies

- Node.js ≥ 22.13.
- Use `markdown-it-mathjax3@^4.3.2`, matching VitePress 1.6's `^4` peer range; do not upgrade this dependency alone to v5.
- pnpm ≥ 10.26 and < 11; the project pins 10.26.0 via `packageManager`, and `allowBuilds` is supported from that release onward ([release notes](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)). Dependencies are locked by the committed `pnpm-lock.yaml`.
- Browser verification additionally requires Microsoft Edge and an existing Playwright installation; the verification scripts never install dependencies.

Playwright is not declared in this project’s dependencies; do not assume the local node_modules contains it.

<!-- readme-section: checks -->
## Checks and local site build

```bash
# Full local verification (no textbook data required)
pnpm run verify

# Export regression: duplicate titles, asset checks, manual revision and append preservation
pnpm test

# Once local site pages are ready, preview or build the VitePress site
pnpm run dev
pnpm run build
pnpm run preview

# Verify standalone HTML using an existing Playwright and Edge
node scripts/verify-native-html.mjs ./node_modules
```

Numeric self-checks cover integer boundaries, float32 special cases, ABI layout, address arithmetic, and stack restoration. Browser verification covers opening `file://` offline, external requests, reading with JavaScript disabled, the outline and interactions, narrow viewports, and re-export after editing. The browser script exercises every slider, dropdown, text/number input, and available button of each experiment. Default lower bounds for body length and formula count are 1 and 0; override them per topic with `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`. Textbooks without experiments can be verified too. A general rule checks local paths and links to private material; extra personal identifiers are passed as a JSON string array through the local environment variable `COURSE_PRIVATE_TERMS` and never enter the repository.

Screenshots and results are written to `internal/native-html-test/`. Browser verification copies the current HTML and manifest into an isolated fixture and validates appending and re-export on the copy, so an interrupted process never touches the authoritative file. The temporary fixture is cleaned up on normal completion; screenshots and reports are kept. A passing typecheck or build never substitutes for real browser verification.

The browser verifier's path argument must directly contain `playwright/`, such as the project's `./node_modules`. For another existing installation, supply the absolute path to its `node_modules`, rather than the project root.

For optional shell regression, run `node --test scripts/browser-shell.test.mjs` after setting `COURSE_PLAYWRIGHT_DIR` to an existing installation's `node_modules` directory. It creates isolated Chinese and English fixtures and checks offline reading, outline messages, custom labels, the component allowlist, and flux endpoints; it skips when the variable is unset. Results are saved in `internal/test-feedback-browser/`.

`pnpm run verify` first checks byte equality of the SKILL copies and matching section markers and runnable examples in the bilingual READMEs and handbook guides (translation meaning is not checked automatically). It then runs the Vue/TypeScript typecheck, ESLint over build scripts, the computational model self-check, and build-contract/export regression tests (including a temporary-page site build) in sequence; it exits successfully only when all pass. Running it locally before committing is enough — the repository stays local-only for authoring, checking, and building, and does not enable GitHub Actions. Browser verification of a real textbook requires an existing Edge and Playwright and is run separately.

Export backups use a timestamp plus a random suffix to avoid same-millisecond collisions; backups are never deleted automatically. Archive `internal/html-export-backups/` manually when you want to prune, and confirm a restore point before deleting old copies.

Git ignore rules only constrain current and future commits; they cannot withdraw already published historical copies. History cleanup requires a private backup and explicit authorization; a local rewrite does not mean remote or cloned copies are cleaned up too.

<!-- readme-section: scope -->
## Repository scope

| Tracked in version control | Local only |
| --- | --- |
| Project instructions, the two synced `SKILL.md` files, docs, license | `sources/` raw material, `internal/` notes and backups |
| `scripts/` build and verification scripts, `standalone/` export runtime | `content/<topic>/` topic manifests and historical Markdown |
| `docs/.vitepress/` site config, shared theme, interactive components | `docs/index.md`, `docs/chapters/`, `docs/public/` pages and assets |
| Dependency manifests, lockfile, TypeScript config, local check scripts | `dist/` single-file textbooks, site cache and build output, deps and local config |

`content/` contributes only its `README.md`; `docs/` contributes only the config and shared theme code under `.vitepress/`, excluding caches and build output. HTML files are ignored too. Do not use `git add -f` to add textbooks or pages to this repository.

**Back up textbook bodies and local topic data separately.** This workflow repository does not back up or restore teaching content.

<!-- readme-section: layout -->
## Directory layout

```text
.
├─ .agents/skills/dialogue-to-course/SKILL.md
├─ AGENTS.md、SKILL.md、README.md    # project instructions, conventions, docs
├─ README.en.md                    # English project overview
├─ handbook/                       # authoring and maintenance guides
├─ content/README.md                # local textbook data usage
├─ docs/.vitepress/                 # site config, shared theme, interactive components
├─ standalone/                     # single-file export runtime and shared layout
├─ scripts/                        # build and verification scripts
├─ package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json
└─ LICENSE
```

Topic data, site pages and assets, `dist/`, `sources/`, `internal/`, `.standalone/`, and `node_modules/` are created or restored locally as needed and are outside version control.
