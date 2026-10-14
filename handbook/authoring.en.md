# Authoring and Build Guide

[Project overview](../README.en.md) · [Maintenance and verification](maintenance.en.md)

<!-- readme-section: environment -->
## Environment and preparation

Use Node.js ≥ 22.13 and the pinned pnpm 10.26.0. See the [maintenance guide](maintenance.en.md) for dependency constraints.

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
  "lang": "zh-CN",
  "output": "my-topic.html",
  "chapters": ["01-introduction.md"]
}
```

The manifest lives at `content/my-topic/manifest.json`; chapters needed for the first import sit in the same directory. Refreshing the assets of an existing HTML still requires the manifest, but does not re-read the old Markdown.

<!-- readme-section: authoring -->
## Authoring and editing

`scripts/build-standalone.mjs` converts Markdown into static semantic HTML at build time, rendering formulas, code highlighting, and experiment initial values, reusing the shared theme and inlining every asset. Runtime JavaScript only enhances the outline, copy buttons, and experiment interaction — it never rebuilds the body. Authoring conventions live in [SKILL.md](../SKILL.md), which must stay in sync with `.agents/skills/dialogue-to-course/SKILL.md`.

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

With no topic or with `--all`, the exporter only processes topics already in `dist/`; an empty directory prompts you to prepare local data and exits with a non-zero code. The first build must name a prepared topic explicitly.

`dist/<topic>.html` is the **single source of truth for the body**. Edit titles, paragraphs, lists, tables, code, and references directly, save, and refresh the browser. Keep exactly one ordered pair of `<!-- course:body:start -->` / `<!-- course:body:end -->` markers. Empty existing files or missing, duplicated, or reversed markers stop the build without overwriting. A default re-export preserves the body; `--from-markdown` replaces it and backs the old file up to `internal/html-export-backups/`.

After changing a formula's `data-tex`, regenerate the static SVG/MathML as well; editing the TeX alone does not refresh the rendered formula.

The outline keeps its fixed left desktop layout and collapsible top navigation on narrow screens, nesting body headings from H2 through H6. Parent headings remain links; arrows or the keyboard expand their subsections. Newly exported outlines use native `details`, which work with JavaScript disabled. Headings inside experiment containers are excluded; mark custom experiments with `data-course-outline="exclude"`. Give manually authored HTML headings stable, unique `id` values. Resource refresh preserves the existing body, while the runtime enhances historical flat outlines with subsections.

Manually revised HTML remains the single source of truth. When appending later, read the current file and insert new content only at the end of the existing `<article>`, before `</article>`; leave existing body text and manual revisions untouched — no reformatting, no rebuild from old Markdown. New anchors must avoid every existing id, and the outline only gains new entries. Earlier sections stay untouched unless you explicitly ask to revise them. Historical backups are for traceability only; verification is based on the current HTML and does not require byte equality with old backups.

When importing multiple chapters from Markdown for the first time, unique heading anchors are generated in one pass. Resource validation parses HTML attributes and CSS and rejects non-inlined images, styles, and other assets; ordinary reference links may remain. External images must be converted to data URLs first — validation does not download anything.

Markdown import uses conservative validation: native HTML tags must be lowercase (for example, `<b>` rather than `<B>`), and components must be allowlisted. A `<style>` block in the body causes an explicit error; reuse shared styles. Tag and style examples inside code fences remain allowed. Each formula is checked at build time for `data-tex` injection and a static SVG; incompatible output fails immediately.

<!-- readme-section: diagrams -->
## Native explanatory diagrams

Use inline SVG in the body when relationships, processes, or changes benefit from a diagram; static drawings require no script. Geometry belongs in drawing attributes, colors use shared variables, and figures, captions, and buttons reuse existing styles without additional drawing libraries or dependencies. Each diagram needs a `viewBox`, an accessible name and description, and a caption. IDs must be unique throughout the HTML. Support quantitative values with evidence and identify conceptual simplifications. Split complex figures to keep labels readable on phones and in dark mode.

The example stays still until the reader plays it, then moves a signal along a path; it supports pause, resume, and reset. Each `data-course-animation` region contains one SVG. All `animate`, `animateMotion`, `animateTransform`, and `set` elements must have `begin="indefinite"`; the shared native script starts them together. Unsupported structures or browsers leave the controls hidden. With JavaScript disabled, animations never start. Reduced motion hides the controls, and backgrounding the page pauses playback. Continuous demonstrations can use `repeatCount="indefinite"` with a fixed duration; after a finite animation ends, reset before playing again.

```html
<figure data-course-animation>
  <svg id="signal-diagram" viewBox="0 0 360 120" role="img" aria-labelledby="signal-title" aria-describedby="signal-desc">
    <title id="signal-title">Signal propagation along a path</title>
    <desc id="signal-desc">A dot travels from input on the left to output on the right. The arrow shows direction. Schematic, not quantitative results.</desc>
    <defs>
      <marker id="signal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--muted)"></path>
      </marker>
    </defs>
    <path d="M 40 60 H 320" fill="none" stroke="var(--muted)" stroke-width="2" marker-end="url(#signal-arrow)"></path>
    <circle cx="40" cy="60" r="9" fill="var(--accent)">
      <animate attributeName="cx" from="40" to="320" dur="4s" begin="indefinite" repeatCount="indefinite"></animate>
    </circle>
    <text x="40" y="100" text-anchor="middle" font-size="24" fill="var(--ink)">Input</text>
    <text x="320" y="100" text-anchor="middle" font-size="24" fill="var(--ink)">Output</text>
  </svg>
  <div data-course-animation-controls hidden>
    <button class="reset" type="button" data-course-animation-play aria-controls="signal-diagram">Play / Resume</button>
    <button class="reset" type="button" data-course-animation-pause aria-controls="signal-diagram" disabled>Pause</button>
    <button class="reset" type="button" data-course-animation-reset aria-controls="signal-diagram">Reset</button>
  </div>
  <figcaption>Read left to right: input → propagation → output. The dot represents a signal and the arrow its direction. Schematic, not quantitative results; the 4-second cycle is only for observation.</figcaption>
</figure>
```

For a static diagram, remove `animate`, the controls, and `data-course-animation`, keeping the SVG and caption. Static attributes must match animation starting values; explain essential steps and conclusions in prose or static panels as well. More complex parameter demonstrations can use native JavaScript inside an isolated region. Canvas drawings require a static SVG/table and a textual alternative.

SVG `<use>`, `<image>`, and drawing attributes may only reference embedded resources. Arrows, gradients, and filters use `#id` / `url(#id)` within the file, never external SVG files. Resource validation also checks animated changes to links, fill, filters, and related properties; it does not download resources. Default repackaging preserves SVG and captions verbatim. Adding diagrams to an existing textbook still means appending only at the end of its current `<article>`.

Browser verification covers initial drawings, actual movement, pause/resume/reset, keyboard controls, JavaScript disabled, reduced motion, offline requests, dark mode, and narrow screens. Implementation references: [SVG animation controls](https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement), [starting an animation](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement), and [SVG local and resource references](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/Linking).

<!-- readme-section: language -->
## Output language

**The body text has no language restriction.** You can author a textbook in Chinese, English, or any other language — the builder does not detect or translate the body language, and the resource validator only checks that assets are inlined. Body text uses a shared sans-serif stack; headings use Georgia, Times New Roman, and Chinese serif fallbacks. Both support Latin and CJK text.

Set `"lang": "en"` in the topic manifest; the default is `zh-CN`. On first import, it sets `<html lang>` and the export shell's outline heading, navigation labels, expand/collapse button, table labels, and copy-button labels. Shared shell messages support Chinese and English; other valid language tags use English shell messages without translating the body.

Default repackaging preserves the existing HTML body and `lang`, including manually revised navigation and tables. For an existing file, edit `<html lang>`, outline text, and the toggle's `data-expand-label` / `data-collapse-label` directly; an existing copy-button `aria-label` is also preserved.

Built-in experiments OmicsLab, ComputerLab, GradientDemo and the site's CourseOutline component still contain Chinese text; experiments are not translated automatically, and `OmicsLab.vue` still formats numbers with `zh-CN`. Site language, title, and navigation are configured separately in `docs/.vitepress/config.mts`.

<!-- readme-section: delivery -->
## Local delivery

Standalone textbooks are written to `dist/<topic>.html`, directly editable and usable offline. The optional VitePress site output goes to `docs/.vitepress/dist/`; the local build path is set through the `SITE_BASE` environment variable — `/` for a domain root, the matching path for a subdirectory.
