# 维护与验证指南

[项目介绍](../README.md) · [制作与构建](authoring.md)

README 只放项目定位、使用入口、能力边界与文档导航。制作操作放在制作指南，工程维护说明放在本指南，具体任务审查与修复记录放在 `internal/`。

<!-- readme-section: dependencies -->
## 依赖环境

- Node.js ≥ 22.13。
- 数学插件使用 `markdown-it-mathjax3@^4.3.2`，与 VitePress 1.6 的 `^4` peer 范围对齐；不要单独升级到 v5。
- pnpm ≥ 10.26 且 < 11；项目通过 `packageManager` 固定为 10.26.0，`allowBuilds` 从该版本起受支持（[官方说明](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/10.26.md)）。使用仓库中的 `pnpm-lock.yaml` 锁定依赖。
- 浏览器验收另需 Microsoft Edge 和已有的 Playwright 安装；验收脚本不会安装依赖。

Playwright 未列入项目依赖，不应假定本项目的 node_modules 中已经包含它。

<!-- readme-section: checks -->
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
node scripts/verify-native-html.mjs ./node_modules
```

数值自检验证整型边界、float32 特例、ABI 布局、地址计算与栈恢复。浏览器验收覆盖断网 `file://` 打开、外部请求、关闭 JavaScript 阅读、目录与交互、窄屏及编辑后重新导出。浏览器脚本逐一操作每个实验的滑块、下拉框、文本/数字输入和可用按钮。正文长度与公式数量的默认下限为 1 和 0，可在主题清单中设置 `"validation": { "minBodyLength": 5000, "minFormulas": 6 }`；不含实验的教材同样可验收。通用规则检查本地路径和私有材料链接；额外个人标识通过本地环境变量 `COURSE_PRIVATE_TERMS` 传入 JSON 字符串数组，不写入仓库。

截图与结果写入 `internal/native-html-test/`。浏览器验收将当前 HTML 及清单复制到隔离夹具，在副本上验证追加与重新导出，进程中断也不会改动权威文件。临时夹具正常结束时自动清理，截图与报告保留；类型检查或构建成功不能代替实际浏览器验收。

浏览器验收的路径参数须直接包含 `playwright/`，例如项目的 `./node_modules`；使用其他已有安装时传入它的 `node_modules` 绝对路径，而不是项目根目录。

可选外壳回归使用 `node --test scripts/browser-shell.test.mjs`：先将环境变量 `COURSE_PLAYWRIGHT_DIR` 设置为已有安装的 `node_modules` 目录。它创建中英文隔离夹具，检查离线阅读、目录文案、自定义标签、组件白名单和通量图端点；未设置变量时跳过。结果保存在 `internal/test-feedback-browser/`。

`pnpm run verify` 先检查两份 SKILL 逐字节一致、中英文 README 和 handbook 手册的章节标记与可执行示例一致（不自动判断翻译语义），再依次运行 Vue/TypeScript 类型检查、构建脚本 ESLint 检查、计算模型自检和构建契约/导出回归（含临时页面的网站构建）。全部通过才退出成功；提交前在本地运行即可，仓库保持仅提供本地制作、检查与构建，不启用 GitHub Actions。真实教材的浏览器验收需要已有 Edge 与 Playwright，单独执行。

导出备份使用时间戳加随机后缀，避免同毫秒冲突；备份不会自动删除。可按保留需要定期人工归档 `internal/html-export-backups/`，确认恢复点后再删除旧副本。

Git 忽略规则只约束当前与后续提交，不能撤回已公开的历史副本。历史清理需要私有备份和授权；本地重写完成不代表远端或他人克隆已同步清理。

<!-- readme-section: scope -->
## 仓库范围

| 纳入版本控制 | 仅保留在本地 |
| --- | --- |
| 项目指令、两份同步的 `SKILL.md`、说明文档、许可证 | `sources/` 原始材料、`internal/` 内部记录与备份 |
| `scripts/` 构建与验收脚本、`standalone/` 导出运行时 | `content/<topic>/` 主题清单和历史 Markdown |
| `docs/.vitepress/` 网站配置、共享主题和交互组件 | `docs/index.md`、`docs/chapters/`、`docs/public/` 等页面和资源 |
| 依赖清单、锁文件、TypeScript 配置、本地检查脚本 | `dist/` 单文件教材、网站缓存及构建结果、依赖与本地配置 |

`content/` 仅提交 `README.md`；`docs/` 仅提交 `.vitepress/` 的配置和共享主题代码，缓存与构建结果除外。HTML 文件也被忽略。不要使用 `git add -f` 把教材或网页加入此仓库。

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
