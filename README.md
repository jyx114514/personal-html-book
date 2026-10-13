# 对话转教材 · Dialogue2Course

把 ChatGPT 对话、科学笔记和本地计算流程整理为中文交互式学术教材。本仓库在 GitHub 上只公开**制作工作流、可复用代码和规范**；实际教材内容保留在本地，**网页由用户自行上传**。

默认交付为每个主题一个单文件 HTML，CSS、JavaScript、字体和图片全部内联。采用固定的学术教材（B）视觉体系，按需嵌入交互实验（D）。同时保留可选的 VitePress 网站模式。

## 仓库范围

| 公开到 GitHub | 仅保留在本地 |
| --- | --- |
| 项目指令、两份同步的 `SKILL.md`、说明文档、许可证 | `sources/` 原始材料、`internal/` 内部记录与备份 |
| `scripts/` 构建与验收脚本、`standalone/` 导出运行时 | `content/<topic>/` 主题清单和历史 Markdown |
| `docs/.vitepress/` 网站配置、共享主题和交互组件 | `docs/index.md`、`docs/chapters/`、`docs/public/` 等页面和资源 |
| 依赖清单、锁文件、TypeScript 配置、代码检查工作流 | `dist/` 单文件教材、网站缓存及构建结果、依赖与本地配置 |

`content/` 仅提交 `README.md`；`docs/` 仅提交 `.vitepress/` 的配置和共享主题代码，缓存与构建结果除外。HTML 文件也被忽略。不要使用 `git add -f` 把教材或网页加入此仓库。

**教材正文及本地主题数据需单独备份。** GitHub 工作流仓库不承担教材备份与恢复。

## 环境与准备

- Node.js ≥ 22；GitHub 代码检查使用 Node.js 22。
- pnpm 10；使用仓库中的 `pnpm-lock.yaml` 锁定依赖。
- 浏览器验收另需 Microsoft Edge 和已有的 Playwright 安装；验收脚本不会安装依赖。

```bash
pnpm install --frozen-lockfile
pnpm run check
node scripts/verify-computer-models.mjs
```

新克隆仓库不包含教材数据。构建教材前，先在本地准备或恢复：

1. `content/<topic>/manifest.json`：主题元数据。
2. `dist/<topic>.html`：已有教材的正文权威版本；首次制作时可先提供清单中的 Markdown 章节。
3. 使用网站模式时，提供 `docs/index.md`、章节和页面资源，并按需调整 `docs/.vitepress/config.mts` 中的导航。

主题清单格式如下，主题标识使用小写字母、数字和连字符：

```json
{
  "topic": "my-topic",
  "title": "教材标题",
  "output": "my-topic.html",
  "chapters": ["01-introduction.md"]
}
```

清单位于 `content/my-topic/manifest.json`；首次导入所需的章节放在同一目录。已有 HTML 的资源刷新仍需该主题清单，但不需要重新读取旧 Markdown。

## 制作和编辑

`scripts/build-standalone.mjs` 在构建期将 Markdown 转成静态语义化 HTML，渲染公式、代码高亮和实验初值，复用共享主题，并内联全部资源。运行时 JavaScript 只增强目录、复制与实验交互，不重建正文。制作规范见 `SKILL.md`，它与 `.agents/skills/dialogue-to-course/SKILL.md` 必须同步。

```bash
# 首次制作：提供清单及章节后，导出该主题
pnpm run build:standalone -- my-topic

# 已有 HTML：刷新内嵌资源，保留正文编辑
pnpm run build:standalone -- my-topic

# 处理 dist 中已有的全部主题
pnpm run build:standalone -- --all

# 显式重新从 Markdown 导入，替换正文（旧文件会备份）
pnpm run build:standalone -- my-topic --from-markdown
```

不指定主题时，导出器读取 `dist/` 中已有主题；如果目录为空，会尝试 `style-sample`。该示例数据不随仓库发布，因此空仓库首次构建应显式指定自己已经准备好的主题。

`dist/<topic>.html` 是正文的**唯一权威版本**。可直接编辑标题、段落、列表、表格、代码与参考文献，保存后刷新浏览器即可。保留 `<!-- course:body:start -->` 和 `<!-- course:body:end -->` 标记。默认重新导出保留正文；`--from-markdown` 会替换正文，旧文件备份到 `internal/html-export-backups/`。

修改公式的 `data-tex` 后，需要同步更新静态 SVG/MathML；仅修改 TeX 不会自动刷新公式显示。

## 检查与本地网站构建

```bash
# 类型检查和计算模型数值自检
pnpm run check
node scripts/verify-computer-models.mjs

# 准备好本地网站页面后，预览或构建 VitePress 网站
pnpm run dev
pnpm run build
pnpm run preview

# 使用已有 Playwright 和 Edge 验收独立 HTML
node scripts/verify-native-html.mjs <含-playwright-的目录>
```

数值自检验证整型边界、float32 特例、ABI 布局、地址计算与栈恢复。浏览器验收覆盖断网 `file://` 打开、外部请求、关闭 JavaScript 阅读、目录与交互、窄屏及编辑后重新导出。浏览器脚本面向原有完整教材，包含正文长度与公式数量等要求；新主题需按其内容调整验收条件。

首次运行浏览器验收前，创建 `internal/html-export-backups/` 目录。截图与结果写入 `internal/native-html-test/`。类型检查或构建成功不能代替实际浏览器验收。

GitHub Actions 的 `.github/workflows/ci.yml` 仅安装锁定依赖、执行类型检查和数值自检。它不依赖本地教材数据，不上传构建产物，也不部署网页。

## 手动上传网页

- 单文件教材：本地构建并验收后，由用户上传 `dist/<topic>.html`。
- 可选 VitePress 网站：准备本地页面，构建后由用户上传 `docs/.vitepress/dist/` 的内容。通过环境变量 `SITE_BASE` 设置路径：域名根目录用 `/`，项目子目录用 `/repo/`。

本项目已移除 GitHub Pages 自动部署工作流，不提供网页发布权限。推送制作工作流不会自动上传教材。不要将网页加入这个工作流仓库，也不要创建包含教材的 Release。

`.gitignore` 只阻止未跟踪文件被加入仓库。已跟踪的教材须通过 `git rm --cached` 停止跟踪，这会保留本地文件。**停止跟踪不会删除历史提交中的内容。** 如果历史里已有教材，后续公开工作流前仍需检查历史；清理历史或强制推送需要用户明确授权。

## 目录结构

```text
.
├─ .github/workflows/ci.yml          # 只检查代码，不发布网页
├─ .agents/skills/dialogue-to-course/SKILL.md
├─ AGENTS.md、SKILL.md、README.md    # 项目指令、制作规范与说明
├─ content/README.md                # 本地教材数据的使用说明
├─ docs/.vitepress/                 # 网站配置、共享主题与交互组件
├─ standalone/                     # 单文件导出运行时与共享布局
├─ scripts/                        # 构建与验收脚本
├─ package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json
└─ LICENSE
```

主题数据、网站页面和资源、`dist/`、`sources/`、`internal/`、`.standalone/`、`node_modules/` 在本地按需创建或恢复，均不属于 GitHub 发布范围。

## 许可

[MIT](LICENSE)。公开教材引用已发表的资料，原始对话与私有核查记录保留在本地。网页上传前由用户完成最终审核。
