# 维护与验证指南

[项目介绍](../README.md) · [制作与构建](authoring.md)

README 只放项目定位、使用入口、能力边界与文档导航。制作操作放在制作指南，工程维护说明放在本指南，具体任务审查与修复记录放在 `internal/`。

<!-- readme-section: dependencies -->
## 依赖环境

- Node.js ≥ 22.13。
- 数学插件使用 `markdown-it-mathjax3@^4.3.2`，与 VitePress 1.6 的 `^4` peer 范围对齐；不要单独升级到 v5。
- pnpm ≥ 10.26 且 < 11；项目通过 `packageManager` 固定为 10.26.0，`allowBuilds` 从该版本起受支持（[官方说明](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)）。使用仓库中的 `pnpm-lock.yaml` 锁定依赖。
- Playwright 及 Vue/TypeScript 的 ESLint 插件与解析器已列入并锁定开发依赖，随 `pnpm install --frozen-lockfile` 安装。
- 浏览器二进制独立于 npm 依赖：Windows 默认使用已有 Microsoft Edge，其他系统默认使用 Playwright Chromium。验收脚本不会静默安装浏览器，缺失时非零退出。可显式执行 `pnpm exec playwright install chromium` 后设置 `COURSE_BROWSER_CHANNEL=chromium`；这只安装测试浏览器，不替换系统 Edge。支持的通道为 `msedge`、`chrome`、`chromium`。

默认读取本项目 `node_modules/playwright`，不再要求外部安装。仍可通过 `COURSE_PLAYWRIGHT_DIR` 指向直接包含 `playwright/` 的已有 `node_modules` 目录。浏览器设置参考 [Playwright 官方文档](https://playwright.dev/docs/browsers)。Windows PowerShell 示例：`$env:COURSE_BROWSER_CHANNEL='chromium'`；Bash 使用 `export COURSE_BROWSER_CHANNEL=chromium`。验收环境缺失不能用跳过测试换取“全部通过”。

<!-- readme-section: checks -->
## 检查与本地网站构建

```bash
# 本地完整验收（无需教材数据；必须有可启动的浏览器）
pnpm run verify

# 仅静态排查，不代表离线可用
pnpm run verify:static

# 单独运行强制浏览器夹具回归
pnpm run verify:browser

# 全部单元与浏览器回归
pnpm test

# 全范围 lint（包括 Vue、TypeScript 与浏览器运行时）
pnpm run lint

# 规范修改后生成 AGENTS 并同步 Skill 副本
pnpm run sync:agents

# 准备好本地网站页面后，预览或构建 VitePress 网站
pnpm run dev
pnpm run build
pnpm run preview

# 对已构建的当前独立 HTML 做交付验收
pnpm run verify:html
```

| 入口 | 覆盖范围 | 能证明什么 |
| --- | --- | --- |
| `verify:static` | 文档同步、类型、全范围 lint、模型自检、导出和网站隔离构建 | 静态检查与构建通过；尚未验证离线可用 |
| `verify:browser` | 中英文外壳、SVG 与阅读批注夹具，真实断网 `file://`、请求监控、禁用 JS、交互与窄屏 | 导出工作流的浏览器回归通过，不代表任意教材已达标 |
| `verify` | 以上两层全部必过；缺浏览器即失败 | 工作流完整本地验收通过 |
| `verify:html` | 本地 `dist/` 中全部当前 HTML 及清单，逐份复制隔离验收 | 报告中列出的当前教材通过自动交付检查；科学内容仍需审阅 |

数值自检验证整型边界、float32 特例、ABI 布局、地址计算与栈恢复。浏览器验收覆盖断网 `file://` 打开、外部请求、关闭 JavaScript 阅读、目录与交互、窄屏及编辑后重新导出。浏览器脚本逐一操作每个实验的滑块、下拉框、文本/数字输入和可用按钮。正文长度与公式数量的默认下限为 1 和 0，可在主题清单中设置 `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`；不含实验的教材同样可验收。通用规则检查本地路径和私有材料链接；额外个人标识通过本地环境变量 `COURSE_PRIVATE_TERMS` 传入 JSON 字符串数组，不写入仓库。

`COURSE_PRIVATE_TERMS` 未设置时按空数组处理；设置后必须为合法 JSON 数组，且每项为非空字符串。JSON 语法或类型错误会在启动浏览器前指出环境变量名称与正确格式，不回显私有标识。图解测试按 HTML 结构识别手册代码块与静态夹具，接受多行属性及 LF/CRLF；缺失、重复或结构错误的图解示例和交互脚本会提示对应手册或 HTML 文件及缺失结构，不再触发无上下文的空匹配错误。

通用隐私检查解析 HTML 文本、注释和属性，按目录名边界识别本地 `sources/`、`internal/` 引用；`resources/` 等不同名称和公开参考 URL 中的同名目录不会误报。原始对话分享链接、本地绝对路径及内部检索标识仍会被拒绝，HTML 属性中的字符实体也会解码后检查。

交付验收按 HTML 结构识别 `article.vp-doc` 和正文段落，允许合法的额外属性、类名及换行；同时检查保存的 HTML、启用及关闭 JavaScript 后的 DOM，拒绝重复 ID、目录目标缺失、目录链接到正文以外或被排除的实验区域。对应回归包含带属性正文通过以及损坏目录被拒的实际导出夹具。

截图与结果写入 `internal/native-html-test/`。浏览器验收将当前 HTML 及清单复制到隔离夹具，在副本上验证追加与重新导出，进程中断也不会改动权威文件。临时夹具正常结束时自动清理，截图与报告保留；类型检查或构建成功不能代替实际浏览器验收。

`verify:html` 默认使用项目依赖；兼容命令 `node scripts/verify-native-html.mjs <node_modules路径>` 的可选参数须直接包含 `playwright/`。缺少教材、清单、Playwright 或可用浏览器均以非零退出码停止，不产生验收成功报告。无 JavaScript 上下文同样监控资源请求，避免静态分支遗漏外部资源。

外壳回归使用 `node --test scripts/browser-shell.test.mjs`，已纳入默认 `verify` 的必过项，不会因未设置 `COURSE_PLAYWRIGHT_DIR` 而跳过。它创建中英文隔离夹具，调用实际交付验收器检查离线阅读、无外部请求、禁用 JS、正文保留，并检查目录文案、自定义标签、组件白名单和通量图端点。结果保存在 `internal/test-feedback-browser/`。

原生图解浏览器回归使用 `node --test scripts/browser-diagrams.test.mjs`，同样是默认 `verify` 的必过项。它实际构建制作手册中的 SVG 示例，检查断网打开、无 JavaScript 静态图、播放/暂停/继续/重置、键盘操作、多图隔离、减少动态效果、深色模式、320/390 像素窄屏及网站换页后的控件初始化。截图、演示 HTML 与报告保存在 `internal/native-diagram-test/`。常规导出回归同时检查 SVG 原样导入、重新打包保留，以及绘图属性与动画值中的外部资源引用。

交付验收比较启用及关闭 JavaScript 后的可读正文时，不计入渐进显示的动画控件标签；图形、图注及正文仍须保留。图解回归同时确认有效动画页面能通过，并注入删除正文段落的脚本，验证检查仍会拒绝真实内容缺失。

阅读批注回归使用 `scripts/annotations.test.mjs` 和 `scripts/browser-annotations.test.mjs`，分别纳入默认静态与浏览器验收。覆盖选区定位、上下文消歧、JSON 校验及合并、删除记录保留、离线高亮和下划线、一键色点、划线弹出菜单、段落下方自动保存与光标保留、各屏幕段落笔记展开和折叠、卡片防重叠、粗体及公式预览和离线渲染、错误公式与转义、安全过滤、编辑与撤销、本地保存和重开、带格式的 JSON 备份恢复及 Markdown 导出、正文保护、缺失原文提示、旧浏览器标记回退、存储被禁用或已满、暗色与 320/390/800/1280/1440 像素视口。截图、报告与可打开的 `demo.html` 保存在 `internal/annotation-test/`。本轮运行生成的笔记仅用于测试夹具，不写入教材正文。

重复选区回归在 CSS 高亮和文字标记回退两种模式中验证：改色和切换画笔复用原记录、再次写笔记打开原内容、工具条及数字快捷键沿用选区已有样式、无变化操作不生成撤销步骤、重开及原文位移后仍能识别；相同文字的不同位置和部分重叠选区仍相互独立。

`pnpm run verify` 先检查两份 SKILL 逐字节一致、AGENTS 与根目录 SKILL 的唯一入口区块一致、中英文文档章节及可执行示例一致（不自动判断翻译语义），再执行类型检查、全范围 lint、数值自检、契约/导出回归（含网站构建），最后执行强制浏览器夹具回归。静态入口输出明确标注“尚未验证离线可用”。仓库按用户约定保持仅本地验收，不启用 GitHub Actions；没有 CI 不构成本地检查可省略的理由。

ESLint 覆盖 `scripts/`、`standalone/`、`docs/.vitepress/theme/` 下的 JavaScript、TypeScript 和全部 Vue 组件，以及网站与 lint 配置；使用 Vue essential 和 TypeScript recommended 规则，警告也导致失败。TypeScript 标识符交给 `vue-tsc`，避免把类型名称当作未定义变量。检查回归会向 Vue 模板、TypeScript 和浏览器 JavaScript 注入缺陷，确认这些路径确实受规则保护。配置参考 [Vue ESLint](https://eslint.vuejs.org/user-guide/) 与 [TypeScript ESLint](https://typescript-eslint.io/users/configs/)。

根目录 `SKILL.md` 是制作规范及 Agent 入口的唯一可编辑来源，`AGENTS.md` 从其中唯一的 `agent-entry` 区块生成，`.agents/skills/dialogue-to-course/SKILL.md` 是字节一致副本；详细追加与图解操作只在制作手册维护。更新源后运行 `pnpm run sync:agents`。验收只检查、不自动修复漂移；改动入口文字、规范源而未生成、重复/缺失/倒序区块标记均会失败。此检查保证受管文本一致，不判断所有自然语言陈述的语义正确性。

导出备份使用时间戳加随机后缀，避免同毫秒冲突；备份不会自动删除。可按保留需要定期人工归档 `internal/html-export-backups/`，确认恢复点后再删除旧副本。

单文件客户端按当前正文所需的实验组件组合构建，同一批次内复用相同组合的打包结果。导出回归覆盖无实验、各单独组件、混合组件和直接编辑 HTML 增删实验后的重新打包，检查脚本及样式没有夹带未使用的实验依赖，并确认正文保留。复制按钮的浏览器回归验证实际剪贴板内容、键盘触发和失败提示。

Git 忽略规则只约束当前与后续提交，不能撤回已公开的历史副本。历史清理需要私有备份和授权；本地重写完成不代表远端或他人克隆已同步清理。

<!-- readme-section: scope -->
## 仓库范围

| 纳入版本控制 | 仅保留在本地 |
| --- | --- |
| 项目指令、两份同步的 `SKILL.md`、说明文档、许可证 | `sources/` 原始材料、`internal/` 内部记录与备份 |
| `scripts/` 构建与验收脚本、`standalone/` 导出运行时 | `content/<topic>/` 主题清单和历史 Markdown |
| `docs/.vitepress/` 网站配置、共享主题和交互组件 | `docs/index.md`、`docs/chapters/`、`docs/public/` 等页面和资源 |
| 依赖清单、锁文件、TypeScript 配置、本地检查脚本 | `dist/` 单文件教材、网站缓存及构建结果、依赖与本地配置 |
| 根目录 `example.html` 公开样式与交互预览 | 其他 HTML、个人教材与临时对比文件 |

`content/` 仅提交 `README.md`；`docs/` 仅提交 `.vitepress/` 的配置和共享主题代码，缓存与构建结果除外。根目录 `example.html` 是明确保留的公开样式预览，复用当前共享资源；其他 HTML 文件均被忽略。不要使用 `git add -f` 把教材或网页加入此仓库。

**教材正文及本地主题数据需单独备份。** 工作流仓库不承担教材备份与恢复。

<!-- readme-section: layout -->
## 目录结构

```text
.
├─ .agents/skills/dialogue-to-course/SKILL.md
├─ AGENTS.md、SKILL.md、README.md    # 项目指令、制作规范与说明
├─ README.en.md                     # 英文项目说明
├─ handbook/                       # 制作与维护手册
├─ content/README.md                # 本地教材数据的使用说明
├─ docs/.vitepress/                 # 网站配置、共享主题与交互组件
├─ standalone/                     # 单文件导出运行时与共享布局
├─ scripts/                        # 构建与验收脚本
├─ package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json
└─ LICENSE
```

主题数据、网站页面和资源、`dist/`、`sources/`、`internal/`、`.standalone/`、`node_modules/` 在本地按需创建或恢复，均不属于版本控制范围。
