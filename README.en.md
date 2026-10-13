# Dialogue / Notes → Interactive HTML Textbook

> 中文版：[README.md](README.md)（简体中文说明，内容同步）

Turn ChatGPT conversations, scientific notes, and local computational workflows into **interactive single-file HTML textbooks**. This repository tracks only the **authoring workflow, reusable code, and conventions**; actual textbook content and build artifacts stay on your local machine.

The default deliverable is **one self-contained HTML file per topic**, with CSS, JavaScript, fonts, and images all inlined. It follows a fixed academic textbook (B) visual system and embeds interactive experiments (D) where they help. An optional VitePress site mode is also available.

## Output language

**The body text has no language restriction.** You can author a textbook in Chinese, English, or any other language — the builder never inspects, translates, or rewrites the prose, and the resource validator only checks that assets are inlined. The font stack (`Inter`, `"Noto Sans SC"`, `"Microsoft YaHei"`, `sans-serif`) renders both Latin and CJK text correctly.

One caveat, verified against the current code: a **small amount of export chrome is still hardcoded in Chinese**, independent of the content language:

| Location | Hardcoded element |
| --- | --- |
| `scripts/build-standalone.mjs` | `<html lang="zh-CN">`, outline `aria-label` ("教材目录"), outline heading ("阅读目录"), outline toggle button ("展开目录"), scrollable-table `aria-label` ("可横向滚动的数据表") |
| `standalone/main.ts` | code-block copy button `aria-label` ("复制代码") |
| `docs/.vitepress/theme/outline.ts` | runtime toggle labels ("展开目录" / "收起目录"), which overwrite the initial HTML text |
| `docs/.vitepress/theme/components/*.vue` | UI copy inside the built-in experiment components (OmicsLab, ComputerLab, GradientDemo, CourseOutline); `OmicsLab.vue` also uses `toLocaleString('zh-CN')` |
| `docs/.vitepress/config.mts` | VitePress site `lang`, `title`, and nav/sidebar labels (user-editable per topic, not a build-time limit) |

An English textbook therefore exports and reads correctly, but the outline, toggle button, and built-in experiment labels remain Chinese. Editing the body text of an exported file directly repairs the visible headings; the remaining labels require changes to the shared build script and theme, which are outside the scope of a README edit.

## Usage

Hand a ChatGPT conversation, scientific notes, or a local computational workflow to any agent and ask it to produce an explanatory HTML page.

HTML styling is constrained on purpose; you can instruct the agent to adjust the corresponding style constraints in this repository.

Output quality still depends on the model and harness you use.

Because requirements vary, no constraint is imposed on source retrieval during authoring — the model is only asked to list references. **Verify the correctness of the final content yourself.**

## Repository scope

| Tracked in version control | Local only |
| --- | --- |
| Project instructions, the two synced `SKILL.md` files, docs, license | `sources/` raw material, `internal/` notes and backups |
| `scripts/` build and verification scripts, `standalone/` export runtime | `content/<topic>/` topic manifests and historical Markdown |
| `docs/.vitepress/` site config, shared theme, interactive components | `docs/index.md`, `docs/chapters/`, `docs/public/` pages and assets |
| Dependency manifests, lockfile, TypeScript config, local check scripts | `dist/` single-file textbooks, site cache and build output, deps and local config |

`content/` contributes only its `README.md`; `docs/` contributes only the config and shared theme code under `.vitepress/`, excluding caches and build output. HTML files are ignored too. Do not use `git add -f` to add textbooks or pages to this repository.

**Back up textbook bodies and local topic data separately.** This workflow repository does not back up or restore teaching content.

## Environment and preparation

- Node.js ≥ 22.13.
- pnpm ≥ 10.26 and < 11; the project pins 10.26.0 via `packageManager`, and `allowBuilds` is supported from that release onward ([release notes](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)). Dependencies are locked by the committed `pnpm-lock.yaml`.
- Browser verification additionally requires Microsoft Edge and an existing Playwright installation; the verification scripts never install dependencies.

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

A fresh clone contains no textbook data. Before building, prepare or restore locally:

1. `content/<topic>/manifest.json` — topic metadata.
2. `dist/<topic>.html` — the authoritative body of an existing textbook; for a first build, supply the Markdown chapters listed in the manifest instead.
3. For site mode, provide `docs/index.md`, chapters, and page assets. A missing home page makes the build fail explicitly with a non-zero exit code; preset navigation only shows pages that exist locally, and new chapters may require edits to `docs/.vitepress/config.mts`.

Manifest format; the topic id uses lowercase letters, digits, and hyphens:

```json
{
  "topic": "my-topic",
  "title": "Textbook title",
  "output": "my-topic.html",
  "chapters": ["01-introduction.md"]
}
```

The manifest lives at `content/my-topic/manifest.json`; chapters needed for the first import sit in the same directory. Refreshing the assets of an existing HTML still requires the manifest, but does not re-read the old Markdown.

## Authoring and editing

`scripts/build-standalone.mjs` converts Markdown into static semantic HTML at build time, rendering formulas, code highlighting, and experiment initial values, reusing the shared theme and inlining every asset. Runtime JavaScript only enhances the outline, copy buttons, and experiment interaction — it never rebuilds the body. Authoring conventions live in `SKILL.md`, which must stay in sync with `.agents/skills/dialogue-to-course/SKILL.md`.

```bash
# First build: after supplying the manifest and chapters, export the topic
pnpm run build:standalone my-topic

# Existing HTML: refresh inlined assets while preserving body edits
pnpm run build:standalone my-topic

# Process every topic already present in dist/
pnpm run build:standalone --all

# Explicitly re-import from Markdown, replacing the body (old file is backed up)
pnpm run build:standalone my-topic --from-markdown
```

With no topic or with `--all`, the exporter only processes topics already in `dist/`; an empty directory prompts you to prepare local data and exits with a non-zero code instead of falling back to the `style-sample` that is not shipped with the repository. The first build must name a prepared topic explicitly. The scripts also tolerate the `--` separator placed before arguments in older examples.

`dist/<topic>.html` is the **single source of truth for the body**. Edit titles, paragraphs, lists, tables, code, and references directly, save, and refresh the browser. Keep the `<!-- course:body:start -->` and `<!-- course:body:end -->` markers. A default re-export preserves the body; `--from-markdown` replaces it and backs the old file up to `internal/html-export-backups/`.

After changing a formula's `data-tex`, regenerate the static SVG/MathML as well; editing the TeX alone does not refresh the rendered formula.

Manually revised HTML remains the single source of truth. When appending later, read the current file and insert new content only at the end of the existing `<article>`, before `</article>`; leave existing body text and manual revisions untouched — no reformatting, no rebuild from old Markdown. New anchors must avoid every existing id, and the outline only gains new entries. Earlier sections stay untouched unless you explicitly ask to revise them. Historical backups are for traceability only; verification is based on the current HTML and does not require byte equality with old backups.

When importing multiple chapters from Markdown for the first time, unique heading anchors are generated in one pass. Resource validation parses HTML attributes and CSS and rejects non-inlined images, styles, and other assets; ordinary reference links may remain. External images must be converted to data URLs first — validation does not download anything.

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
node scripts/verify-native-html.mjs <directory-containing-playwright>
```

Numeric self-checks cover integer boundaries, float32 special cases, ABI layout, address arithmetic, and stack restoration. Browser verification covers opening `file://` offline, external requests, reading with JavaScript disabled, the outline and interactions, narrow viewports, and re-export after editing. The browser script exercises every slider, dropdown, text/number input, and available button of each experiment. Default lower bounds for body length and formula count are 1 and 0; override them per topic with `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`. Textbooks without experiments can be verified too. A general rule checks local paths and links to private material; extra personal identifiers are passed as a JSON string array through the local environment variable `COURSE_PRIVATE_TERMS` and never enter the repository.

Screenshots and results are written to `internal/native-html-test/`. Browser verification copies the current HTML and manifest into an isolated fixture and validates appending and re-export on the copy, so an interrupted process never touches the authoritative file. The temporary fixture is cleaned up on normal completion; screenshots and reports are kept. A passing typecheck or build never substitutes for real browser verification.

`pnpm run verify` runs the Vue/TypeScript typecheck, ESLint over build scripts, the computational model self-check, and the export regression (including a temporary-page site build) in sequence; it exits successfully only when all pass. Running it locally before committing is enough — the repository stays local-only for authoring, checking, and building, and does not enable GitHub Actions. Browser verification of a real textbook requires an existing Edge and Playwright and is run separately.

Export backups use a timestamp plus a random suffix to avoid same-millisecond collisions; backups are never deleted automatically. Archive `internal/html-export-backups/` manually when you want to prune, and confirm a restore point before deleting old copies.

Git ignore rules only constrain current and future commits; they cannot withdraw already published historical copies. History cleanup requires a private backup and explicit authorization; a local rewrite does not mean remote or cloned copies are cleaned up too.

## Local delivery

Standalone textbooks are written to `dist/<topic>.html`, directly editable and usable offline. The optional VitePress site output goes to `docs/.vitepress/dist/`; the local build path is set through the `SITE_BASE` environment variable — `/` for a domain root, the matching path for a subdirectory.

## Directory layout

```text
.
├─ .agents/skills/dialogue-to-course/SKILL.md
├─ AGENTS.md、SKILL.md、README.md    # project instructions, conventions, docs
├─ README.en.md                    # English version of this document
├─ content/README.md                # local textbook data usage
├─ docs/.vitepress/                 # site config, shared theme, interactive components
├─ standalone/                     # single-file export runtime and shared layout
├─ scripts/                        # build and verification scripts
├─ package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json
└─ LICENSE
```

Topic data, site pages and assets, `dist/`, `sources/`, `internal/`, `.standalone/`, and `node_modules/` are created or restored locally as needed and are outside version control.

## License

[MIT](LICENSE). Published textbooks cite already published sources; raw conversations and private verification records stay local. The user performs final review before local delivery.
