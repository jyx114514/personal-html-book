# 对话转教材 · Dialogue2Course

把 ChatGPT 对话、科学笔记和本地计算流程整理为中文交互式学术教材。本仓库仅跟踪**制作工作流、可复用代码和规范**；实际教材内容和交付产物保留在本地。

默认交付为每个主题一个单文件 HTML，CSS、JavaScript、字体和图片全部内联。采用固定的学术教材（B）视觉体系，按需嵌入交互实验（D）。同时保留可选的 VitePress 网站模式。

## 仓库范围

| 纳入版本控制 | 仅保留在本地 |
| --- | --- |
| 项目指令、两份同步的 `SKILL.md`、说明文档、许可证 | `sources/` 原始材料、`internal/` 内部记录与备份 |
| `scripts/` 构建与验收脚本、`standalone/` 导出运行时 | `content/<topic>/` 主题清单和历史 Markdown |
| `docs/.vitepress/` 网站配置、共享主题和交互组件 | `docs/index.md`、`docs/chapters/`、`docs/public/` 等页面和资源 |
| 依赖清单、锁文件、TypeScript 配置、本地检查脚本 | `dist/` 单文件教材、网站缓存及构建结果、依赖与本地配置 |

`content/` 仅提交 `README.md`；`docs/` 仅提交 `.vitepress/` 的配置和共享主题代码，缓存与构建结果除外。HTML 文件也被忽略。不要使用 `git add -f` 把教材或网页加入此仓库。

**教材正文及本地主题数据需单独备份。** 工作流仓库不承担教材备份与恢复。

## 环境与准备

- Node.js ≥ 22.13。
- pnpm ≥ 10.26 且 < 11；项目通过 `packageManager` 固定为 10.26.0，`allowBuilds` 从该版本起受支持（[官方说明](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)）。使用仓库中的 `pnpm-lock.yaml` 锁定依赖。
- 浏览器验收另需 Microsoft Edge 和已有的 Playwright 安装；验收脚本不会安装依赖。

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

新克隆仓库不包含教材数据。构建教材前，先在本地准备或恢复：

1. `content/<topic>/manifest.json`：主题元数据。
2. `dist/<topic>.html`：已有教材的正文权威版本；首次制作时可先提供清单中的 Markdown 章节。
3. 使用网站模式时，提供 `docs/index.md`、章节和页面资源。缺少首页时构建会明确报错并以非零退出码停止；预置导航只显示本地存在的页面，新增章节需按需调整 `docs/.vitepress/config.mts`。

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
pnpm run build:standalone my-topic

# 已有 HTML：刷新内嵌资源，保留正文编辑
pnpm run build:standalone my-topic

# 处理 dist 中已有的全部主题
pnpm run build:standalone --all

# 显式重新从 Markdown 导入，替换正文（旧文件会备份）
pnpm run build:standalone my-topic --from-markdown
```

不指定主题或使用 `--all` 时，导出器只处理 `dist/` 中已有主题；目录为空会提示准备本地数据并以非零退出码停止，不再回退到未随仓库提供的 `style-sample`。首次构建需显式指定已经准备好的主题。脚本也兼容旧示例中放在参数开头的 `--` 分隔符。

`dist/<topic>.html` 是正文的**唯一权威版本**。可直接编辑标题、段落、列表、表格、代码与参考文献，保存后刷新浏览器即可。保留 `<!-- course:body:start -->` 和 `<!-- course:body:end -->` 标记。默认重新导出保留正文；`--from-markdown` 会替换正文，旧文件备份到 `internal/html-export-backups/`。

修改公式的 `data-tex` 后，需要同步更新静态 SVG/MathML；仅修改 TeX 不会自动刷新公式显示。

人工修订后的 HTML 继续作为唯一权威版本。后续追加时，读取当前文件，只在现有 `<article>` 的末尾、`</article>` 之前插入新内容；已有正文及人工修订保持原样，不重新排版或从旧 Markdown 重建。新增锚点避开所有已有 ID，目录仅追加新项目。除非明确要求修改既有内容，否则不改前面的章节。历史备份仅用于溯源，验收以当前 HTML 为基准，不要求与旧备份全文相同。

首次从 Markdown 导入多个章节时，统一生成唯一标题锚点。资源校验解析 HTML 属性和 CSS，拒绝未内嵌的图片、样式及其他资源；普通参考文献链接可以保留。外部图片须先转换为 data URL，校验不会自动下载资源。

## 检查与本地网站构建

```bash
# 本地完整验收（无需教材数据）
pnpm run verify

# 导出回归：重复标题、资源检查、人工修订及末尾追加保留
pnpm test

# 准备好本地网站页面后，预览或构建 VitePress 网站
pnpm run dev
pnpm run build
pnpm run preview

# 使用已有 Playwright 和 Edge 验收独立 HTML
node scripts/verify-native-html.mjs <含-playwright-的目录>
```

数值自检验证整型边界、float32 特例、ABI 布局、地址计算与栈恢复。浏览器验收覆盖断网 `file://` 打开、外部请求、关闭 JavaScript 阅读、目录与交互、窄屏及编辑后重新导出。浏览器脚本逐一操作每个实验的滑块、下拉框、文本/数字输入和可用按钮。正文长度与公式数量的默认下限为 1 和 0，可在主题清单中设置 `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`；不含实验的教材同样可验收。通用规则检查本地路径和私有材料链接；额外个人标识通过本地环境变量 `COURSE_PRIVATE_TERMS` 传入 JSON 字符串数组，不写入仓库。

截图与结果写入 `internal/native-html-test/`。浏览器验收将当前 HTML 及清单复制到隔离夹具，在副本上验证追加与重新导出，进程中断也不会改动权威文件。临时夹具正常结束时自动清理，截图与报告保留；类型检查或构建成功不能代替实际浏览器验收。

`pnpm run verify` 依次运行 Vue/TypeScript 类型检查、构建脚本 ESLint 检查、计算模型自检和导出回归（含临时页面的网站构建）。全部通过才退出成功；提交前在本地运行即可，仓库保持仅提供本地制作、检查与构建，不启用 GitHub Actions。真实教材的浏览器验收需要已有 Edge 与 Playwright，单独执行。

导出备份使用时间戳加随机后缀，避免同毫秒冲突；备份不会自动删除。可按保留需要定期人工归档 `internal/html-export-backups/`，确认恢复点后再删除旧副本。

Git 忽略规则只约束当前与后续提交，不能撤回已公开的历史副本。历史清理需要私有备份和授权；本地重写完成不代表远端或他人克隆已同步清理。

## 本地交付

独立教材输出为 `dist/<topic>.html`，可直接编辑并离线使用。可选 VitePress 网站输出为 `docs/.vitepress/dist/`；本地构建路径通过环境变量 `SITE_BASE` 设置，域名根目录使用 `/`，子目录使用对应的路径。

## 目录结构

```text
.
├─ .agents/skills/dialogue-to-course/SKILL.md
├─ AGENTS.md、SKILL.md、README.md    # 项目指令、制作规范与说明
├─ content/README.md                # 本地教材数据的使用说明
├─ docs/.vitepress/                 # 网站配置、共享主题与交互组件
├─ standalone/                     # 单文件导出运行时与共享布局
├─ scripts/                        # 构建与验收脚本
├─ package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json
└─ LICENSE
```

主题数据、网站页面和资源、`dist/`、`sources/`、`internal/`、`.standalone/`、`node_modules/` 在本地按需创建或恢复，均不属于版本控制范围。

## 许可

[MIT](LICENSE)。公开教材引用已发表的资料，原始对话与私有核查记录保留在本地。本地交付前由用户完成最终审核。
