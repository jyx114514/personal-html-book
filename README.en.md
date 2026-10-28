# Conversations and Notes to Interactive HTML

[中文](README.md)

A local authoring workflow for Codex and other AI agents to turn ChatGPT conversations, scientific notes, and local computational workflows into structured, readable, interactive HTML textbooks or notes.

The agent organizes content, researches and checks sources, adds explanations, and creates interactions. This repository supplies authoring rules, shared styles, components, and build checks. The default output is one offline HTML file per topic; an optional VitePress site mode is also available.

<!-- readme-section: usage -->
## How to use

Open this repository in an agent that can read and write local files and run commands. Provide your source material, intended audience, and the questions you want explained. For example:

> Read AGENTS.md and its referenced authoring rules. Turn the conversations and notes I provide into an interactive HTML textbook for readers with basic background but no knowledge of this topic. Add necessary context, check key claims, and cite sources. Preserve actual computational steps and parameters, and distinguish results that were executed and verified. Build the output, run applicable checks, and report the HTML path and any unverified items.

First-time setup requires Node.js ≥ 22.13 and the project's pinned pnpm 10.26.0. Prepare dependencies and check the workflow:

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

`verify` now requires offline browser fixture regression; a passing typecheck or build alone is insufficient. Playwright is a dev dependency. Windows uses existing Microsoft Edge by default; other platforms use installed Playwright Chromium. See the [maintenance guide](handbook/maintenance.en.md) for browser setup and failure handling. `verify:static` is only for static diagnosis and does not establish offline usability. After building a real textbook, also run `pnpm run verify:html` against the current files.

A fresh clone includes the public style preview `example.html`, but no personal textbooks or topic data. The agent prepares a topic using the [authoring and build guide](handbook/authoring.en.md), then outputs `dist/<topic>.html`, which opens directly in a browser. For revisions or additions, give the agent the current HTML: it is the authoritative body.

<!-- readme-section: output -->
## Output and limitations

- A consistent academic layout with formulas, code, tables, references, and interactive experiments where useful.
- Static diagrams and animated explanations where useful, drawn with inline SVG or other native browser features; play, pause, and reset without extra drawing dependencies.
- Body text stored directly in editable HTML; static content remains readable with JavaScript disabled.
- Four-color highlights, underlines, and paragraph notes with bold and formulas, browser storage, JSON backup/restore, and Markdown export.
- The task determines the body language. The export shell supports Chinese and English; built-in experiments currently use mostly Chinese.
- Authoring rules require research and fact checking, but build checks cannot establish scientific correctness. Review the final content; quality depends on the model, tool environment, and input material.

The repository stores the authoring workflow, reusable code, and the public style preview `example.html`. Source materials, internal records, topic data, and generated textbooks remain local and **require separate backups**.

<!-- readme-section: documentation -->
## Documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Generated Agent entry point and rule navigation from SKILL (Chinese) |
| [SKILL.md](SKILL.md) | Content structure, source checking, visual and delivery rules (Chinese) |
| [Authoring and build guide](handbook/authoring.en.md) | Manifests, first import, HTML editing, asset packaging, and site mode |
| [Maintenance and verification guide](handbook/maintenance.en.md) | Dependency constraints, regression tests, browser checks, and code layout |
| [Local topic data](content/README.md) | Storing and restoring topic files (Chinese) |

<!-- readme-section: style-example -->
## Style Example

[View the style example online](https://jyx114514.github.io/personal-html-book/example.html), or download [example.html](example.html) from the repository and open it offline.

The example shows the nested outline, formulas, code copying, tables, interactive experiments, native animated diagrams, and paragraph notes. Select body text to try highlights, underlines, and annotations. Notes support bold text, formulas, autosave, and import/export. This page demonstrates styling and interactions; it is not a complete PCR analysis guide.

<!-- readme-section: license -->
## License

Project code and conventions are licensed under [CC BY-NC 4.0](LICENSE). Input material and cited resources retain their own licenses.
