# Authoring and Build Guide

[Project overview](../README.en.md) · [Maintenance and verification](maintenance.en.md)

<!-- readme-section: environment -->
## Environment and preparation

Use Node.js ≥ 22.13 and the pinned pnpm 10.26.0. See the [maintenance guide](maintenance.en.md) for dependency constraints.

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

Full workflow verification requires offline browser fixtures; see the [maintenance guide](maintenance.en.md) for browser setup. Only `verify:static` avoids launching a browser, and it does not establish offline acceptance. After building a real textbook, run `pnpm run verify:html`; passing fixtures does not replace verification of the current deliverable.

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

`scripts/build-standalone.mjs` converts Markdown into static semantic HTML at build time, rendering formulas, code highlighting, and experiment initial values, reusing the shared theme and inlining every asset. Runtime JavaScript only enhances the outline, copy buttons, and experiment interaction — it never rebuilds the body. The root [SKILL.md](../SKILL.md) is the sole editable source of authoring conventions. After editing it, run `pnpm run sync:agents` to generate `AGENTS.md` and synchronize `.agents/skills/dialogue-to-course/SKILL.md`; verification rejects drift.

The exporter bundles only allowlisted experiment components identified by `data-course-component` in the current HTML body. Without those experiments, it includes only native outline, copy, and diagram scripts, omitting the Vue experiment runtime. Default asset refresh also rescans the current body, so adding or removing experiments directly in HTML updates their dependencies on re-export while preserving the body.

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

Code and text blocks reuse the toolbar in `docs/.vitepress/theme/custom.css`: a dedicated 48px top row shows the language on the left and an always-visible “Copy code” text button on the right. Code occupies the next row and can scroll horizontally. Successful copying shows “Copied” inside the same button, without a tooltip covering the code. Keep a visible keyboard focus indicator and prevent overlap in light mode, dark mode, and narrow layouts; do not restore a hover-only floating icon. For standalone HTML, the default `build:standalone <topic>` refreshes shared assets while preserving the body; site mode uses the same theme. Acceptance checks cover Chinese and English labels, persistent visibility, separation from code, and the position of copy feedback.

Standalone HTML supports both highlighted code blocks and `.code` / `.code-bar` markup. If clipboard permission is denied or the API is unavailable, it selects the relevant code and displays a Ctrl+C or ⌘C instruction below the block; if selection fails, it asks the reader to copy manually. Feedback supports Chinese, English, and screen readers without covering code. Browser regression clicks the actual buttons, reads the clipboard, and verifies feedback when permission is denied or the API is missing.

Shared styles generate text for empty highlighted-code copy buttons. Buttons that already contain text display their original label without a second pseudo-element label. Success feedback uses that same text position and restores the original label and child nodes afterward, avoiding duplicate text or a second overflowing line.

The outline keeps its fixed left desktop layout and collapsible top navigation on narrow screens, nesting body headings from H2 through H6. Parent headings remain links; arrows or the keyboard expand their subsections. Newly exported outlines use native `details`, which work with JavaScript disabled. Headings inside experiment containers are excluded; mark custom experiments with `data-course-outline="exclude"`. Give manually authored HTML headings stable, unique `id` values. Resource refresh preserves the existing body, while the runtime enhances historical flat outlines with subsections.

Manually revised HTML remains the single source of truth. When appending later, read the current file and insert new content only at the end of the existing `<article>`, before `</article>`; leave existing body text and manual revisions untouched — no reformatting, no rebuild from old Markdown. New anchors must avoid every existing id, and the outline only gains new entries. Earlier sections stay untouched unless you explicitly ask to revise them. Historical backups are for traceability only; verification is based on the current HTML and does not require byte equality with old backups.

Manually added `<span>` elements, including nesting, anchors, `class`, `style`, `data-*`, and color emphasis, belong to the body. Updates must not unwrap them, delete them, or remove attributes to enforce the shared visual style. Stop and report unclosed tags instead of deleting them and keeping only their text. One-off update scripts must compare the current file with their authoring baseline and stop if it is stale rather than writing an old snapshot back. Verification compares HTML outside the intended edit and checks that manual emphasis remains with JavaScript enabled and disabled.

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

<!-- readme-section: annotations -->
## Highlights and reading notes

New standalone HTML includes a “Notes” button. Selecting body text opens a compact toolbar nearby. Color dots have no preselected color for a new selection; clicking one immediately marks with the current pen. The highlighter or underline icon uses default yellow for new marks and keeps the actual color of an existing mark. New marks do not inherit the last color used. “Note” opens an editor near the quote. Clicking an existing mark lets you change color or style, add a note, or delete it. Selections may span inline elements and paragraphs. The toolbar supports 1–4 for colors and N for notes, with Ctrl+Alt+H / Ctrl+Alt+N retained. Formula graphics, interactive experiments, and controls are excluded.

Reselecting the complete marked range at the same location shows its existing color and style in the toolbar. Recoloring or switching between highlight and underline updates that record and keeps its note; “Note” opens the existing note. Applying an unchanged color and style adds neither a record nor an undo step. Identical wording at different locations and distinct overlapping selections retain independent annotations.

Notes appear below their paragraphs on every screen, expanded by default, with a paragraph note pin to collapse them. Notes on the same paragraph are grouped together, reserving room before the following text. Editing happens inside the card and saves automatically after a pause. Clicking outside, Escape, or Ctrl/⌘+Enter finishes editing. Autosave preserves the caret, empty notes become plain marks, and marks without notes do not occupy the paragraph note area.

Notes support `**bold**`, inline formulas such as `$E=mc^2$`, display formulas such as `$$\sum_{i=1}^{n}x_i$$`, and literal code in backticks. The editor keeps the original syntax and previews it; paragraph notes and the overview use the same renderer. JSON and Markdown exports retain Markdown and TeX source. Incomplete or unsupported formulas remain visible as source; HTML, link, and image syntax is not executed. The existing MathJax dependency supplies offline rendering with scripts, glyphs, and its license embedded. Only base and AMS math packages are enabled, with [formula links and styles filtered](https://docs.mathjax.org/en/v3.2/options/safe.html).

The “Notes” panel groups annotations by section for review, with All / My notes / Highlights, search, color filtering, quote navigation, and editing inside cards. Import, export, undo, and storage guidance are under “More actions”. The mobile overview uses a closable drawer.

Each textbook allows up to 2000 active annotations, counting both marks and notes. Deletion immediately releases active capacity. Deletion records remain in JSON backups to prevent older backups from resurrecting deleted annotations during merging, and do not count toward the active limit. Backup file size limits and the browser's storage quota still apply.

Annotations stay in the current browser and do not automatically rewrite the HTML on disk. Under “More actions”, “Export JSON” and “Import JSON” back up, migrate, and restore notes, merging records for the same textbook. “Export Markdown” produces readable notes. Export first saves current input. Export JSON before moving the HTML, clearing browser data, or switching devices. Storage behavior for direct `file://` access can vary, so browser storage must not be the only backup ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)). If storage is unavailable, full, or damaged, the interface says changes remain only in the current page and still allows exporting them.

The exporter adds a stable textbook identity. Default repackaging preserves the body and keeps that identity for notes. Anchors store the quoted text and surrounding context: inserting text before a quote triggers relocation. Missing or ambiguous quotes stay in the list with an explicit message rather than guessing a new location. JSON from another textbook is rejected. Default `build:standalone <topic>` adds annotation support to existing books.

Interaction design references [EasyRead](https://github.com/Edwardxlai/easyread/tree/ac031c7041836ca157b8b3ce178204f48e923124); this project uses independently written native modules. It uses the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) when available and temporary text marks otherwise. Required scripts and styles are embedded in the single HTML file.

<!-- readme-section: language -->
## Output language

**The body text has no language restriction.** You can author a textbook in Chinese, English, or any other language — the builder does not detect or translate the body language, and the resource validator only checks that assets are inlined. Body text uses a shared sans-serif stack; headings use Georgia, Times New Roman, and Chinese serif fallbacks. Both support Latin and CJK text.

Set `"lang": "en"` in the topic manifest; the default is `zh-CN`. On first import, it sets `<html lang>` and the export shell's outline heading, navigation labels, expand/collapse button, table labels, and copy-button labels. Shared shell messages support Chinese and English; other valid language tags use English shell messages without translating the body.

Default repackaging preserves the existing HTML body and `lang`, including manually revised navigation and tables. For an existing file, edit `<html lang>`, outline text, and the toggle's `data-expand-label` / `data-collapse-label` directly; an existing copy-button `aria-label` is also preserved.

Built-in experiments OmicsLab, ComputerLab, GradientDemo and the site's CourseOutline component still contain Chinese text; experiments are not translated automatically, and `OmicsLab.vue` still formats numbers with `zh-CN`. Site language, title, and navigation are configured separately in `docs/.vitepress/config.mts`.

<!-- readme-section: delivery -->
## Local delivery

Standalone textbooks are written to `dist/<topic>.html`, directly editable and usable offline. The optional VitePress site output goes to `docs/.vitepress/dist/`; the local build path is set through the `SITE_BASE` environment variable — `/` for a domain root, the matching path for a subdirectory.
