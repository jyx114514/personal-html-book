# Maintenance and Verification Guide

[Project overview](../README.en.md) · [Authoring and build](authoring.en.md)

Keep the README focused on project purpose, getting started, limitations, and documentation links. Authoring procedures belong in the authoring guide, engineering details here, and task-specific review records in `internal/`.

<!-- readme-section: dependencies -->
## Dependencies

- Node.js ≥ 22.13.
- Use `markdown-it-mathjax3@^4.3.2`, matching VitePress 1.6's `^4` peer range; do not upgrade this dependency alone to v5.
- pnpm ≥ 10.26 and < 11; the project pins 10.26.0 via `packageManager`, and `allowBuilds` is supported from that release onward ([release notes](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)). Dependencies are locked by the committed `pnpm-lock.yaml`.
- Playwright and the Vue/TypeScript ESLint plugins and parsers are declared and locked dev dependencies, installed by `pnpm install --frozen-lockfile`.
- Browser binaries are separate from npm packages. Windows defaults to existing Microsoft Edge; other platforms default to Playwright Chromium. Verification never silently installs browsers and fails with a nonzero exit when they are missing. Explicitly run `pnpm exec playwright install chromium` and set `COURSE_BROWSER_CHANNEL=chromium` to use a test browser without replacing system Edge. Supported channels: `msedge`, `chrome`, `chromium`.

The default module is the project's `node_modules/playwright`; an external install is no longer required. `COURSE_PLAYWRIGHT_DIR` can still point to an existing `node_modules` that directly contains `playwright/`. See [Playwright's browser documentation](https://playwright.dev/docs/browsers). PowerShell: `$env:COURSE_BROWSER_CHANNEL='chromium'`; Bash: `export COURSE_BROWSER_CHANNEL=chromium`. Missing infrastructure must not become skipped tests reported as success.

<!-- readme-section: checks -->
## Checks and local site build

```bash
# Full local verification (no textbook data required; a working browser is required)
pnpm run verify

# Static diagnosis only; this does not establish offline usability
pnpm run verify:static

# Mandatory browser fixture regression on its own
pnpm run verify:browser

# All unit and browser regressions
pnpm test

# Full lint, including Vue, TypeScript, and browser runtime code
pnpm run lint

# Generate AGENTS and synchronize the Skill copy after editing the source
pnpm run sync:agents

# Once local site pages are ready, preview or build the VitePress site
pnpm run dev
pnpm run build
pnpm run preview

# Delivery verification of the current built standalone HTML files
pnpm run verify:html
```

| Command | Coverage | What passing establishes |
| --- | --- | --- |
| `verify:static` | Documentation, types, full lint, model checks, isolated export and site builds | Static and build checks passed; offline usability remains unverified |
| `verify:browser` | Chinese/English shell and SVG fixtures, offline `file://`, request monitoring, no JS, interactions, narrow viewports | Browser regression of the workflow passed, not acceptance of arbitrary textbooks |
| `verify` | Both layers required; missing browsers fail | Complete local workflow verification passed |
| `verify:html` | All current local `dist/` HTML files and manifests, copied for isolated verification | The current books listed in the report passed automated delivery checks; scientific content still requires review |

Numeric self-checks cover integer boundaries, float32 special cases, ABI layout, address arithmetic, and stack restoration. Browser verification covers opening `file://` offline, external requests, reading with JavaScript disabled, the outline and interactions, narrow viewports, and re-export after editing. The browser script exercises every slider, dropdown, text/number input, and available button of each experiment. Default lower bounds for body length and formula count are 1 and 0; override them per topic with `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`. Textbooks without experiments can be verified too. A general rule checks local paths and links to private material; extra personal identifiers are passed as a JSON string array through the local environment variable `COURSE_PRIVATE_TERMS` and never enter the repository.

Screenshots and results are written to `internal/native-html-test/`. Browser verification copies the current HTML and manifest into an isolated fixture and validates appending and re-export on the copy, so an interrupted process never touches the authoritative file. The temporary fixture is cleaned up on normal completion; screenshots and reports are kept. A passing typecheck or build never substitutes for real browser verification.

`verify:html` defaults to project dependencies. The compatible command `node scripts/verify-native-html.mjs <node_modules-path>` accepts an optional directory directly containing `playwright/`. Missing books, manifests, Playwright, or usable browsers stop with a nonzero exit and do not produce a successful acceptance report. The no-JavaScript context also monitors requests so static branches cannot hide external resources.

Shell regression uses `node --test scripts/browser-shell.test.mjs` and is mandatory in default `verify`; an unset `COURSE_PLAYWRIGHT_DIR` never skips it. It creates Chinese and English fixtures and calls the production verifier for offline reading, no external requests, no JS, and body preservation; it also checks outline messages, custom labels, the component allowlist, and flux endpoints. Results are saved in `internal/test-feedback-browser/`.

Native diagram regression uses `node --test scripts/browser-diagrams.test.mjs` and is also mandatory in default `verify`. It builds the authoring guide's SVG example and checks offline loading, static drawings without JavaScript, play/pause/resume/reset, keyboard controls, isolated figures, reduced motion, dark mode, 320/390-pixel viewports, and control initialization after site navigation. Screenshots, a demo HTML, and results go to `internal/native-diagram-test/`. Regular export regression also checks verbatim SVG import and repackaging, plus external resource references in drawing attributes and animation values.

`pnpm run verify` first checks byte equality of Skill copies, AGENTS equality with the root Skill's single entry block, and bilingual section markers and runnable examples (translation meaning is not checked automatically). It then runs types, full lint, numeric checks, contract/export regression including site builds, and mandatory browser fixtures. The static command explicitly reports offline usability as unverified. Per the user's agreement, verification remains local and GitHub Actions stays disabled; absence of CI does not make local checks optional.

ESLint covers JavaScript, TypeScript, and every Vue component in `scripts/`, `standalone/`, and `docs/.vitepress/theme/`, plus site and lint configuration. Vue essential and TypeScript recommended rules are enabled, and warnings fail the check. `vue-tsc` handles TypeScript identifiers so type names are not flagged as undefined variables. Regression injects defects into Vue templates, TypeScript, and browser JavaScript to prove these paths are protected. References: [Vue ESLint](https://eslint.vuejs.org/user-guide/) and [TypeScript ESLint](https://typescript-eslint.io/users/configs/).

The root `SKILL.md` is the sole editable source of authoring rules and the Agent entry point. `AGENTS.md` is generated from its unique `agent-entry` block; `.agents/skills/dialogue-to-course/SKILL.md` is a byte-identical copy. Detailed append and diagram procedures live only in the authoring guide. Run `pnpm run sync:agents` after changing the source. Verification checks without automatically repairing drift; edits to generated text, stale copies, and duplicate, missing, or reversed markers fail. This checks managed text consistency, not the semantic correctness of every natural-language statement.

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
