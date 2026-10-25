# 对话与笔记转交互式 HTML

[English](README.en.md)

这是一个供 Codex 等 AI agent 使用的本地制作工作流：把 ChatGPT 对话、科学笔记和本地计算流程整理成结构清晰、可阅读和探索的交互式 HTML 教材或笔记。

Agent 负责组织内容、检索与核查资料、补充解释和制作交互；仓库提供制作规范、共享样式、组件及构建检查工具。默认每个主题交付一个可离线打开的 HTML 文件，也支持可选的 VitePress 网站模式。

<!-- readme-section: usage -->
## 如何使用

在支持读写本地文件、运行命令的 agent 中打开本仓库，提供原始材料、目标读者和希望讲清楚的问题。例如：

> 请阅读 AGENTS.md 和其中指定的制作规范，把我提供的对话与笔记整理成一个交互式 HTML 教材。面向有基础但不了解该主题的读者，补充必要背景，核查关键论述并列出参考资料；保留实际计算步骤和参数，说明哪些结果已经运行验证。完成构建和适用检查后，给出 HTML 文件路径及未验证事项。

首次使用需要 Node.js ≥ 22.13 和项目指定的 pnpm 10.26.0。准备依赖并检查工作流：

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

`verify` 现在必须通过离线浏览器夹具回归，不能只凭类型检查或构建通过。Playwright 已列入开发依赖；Windows 默认使用已有 Microsoft Edge，其他系统默认使用已安装的 Playwright Chromium。浏览器准备与失败处理见[维护指南](handbook/maintenance.md)。`verify:static` 仅用于静态排查，不能证明离线可用；具体教材构建后还需运行 `pnpm run verify:html` 验收当前文件。

新克隆不包含教材示例或主题数据；agent 按[制作与构建指南](handbook/authoring.md)准备主题后，输出到 `dist/<topic>.html`，可直接用浏览器打开。后续修订或追加时，把当前 HTML 交给 agent；它是正文的权威版本。

<!-- readme-section: output -->
## 输出与边界

- 统一的学术教材样式，支持公式、代码、表格、参考文献和按需加入的交互实验。
- 按需用内嵌 SVG 等浏览器原生方式绘制静态图解或可播放、暂停、重置的动态讲解图片，无需额外绘图依赖。
- 正文直接存储在 HTML 中，可编辑；关闭 JavaScript 仍能阅读静态内容。
- 正文语言由任务指定；导出外壳支持中文和英文，内置实验目前主要使用中文。
- 制作规范要求资料检索和事实核查，但构建检查不能判断科学结论是否正确；最终内容仍需审阅，质量受模型、工具环境和输入材料影响。

仓库仅保存制作工作流与可复用代码。原始材料、内部记录、主题数据和生成教材保留在本地，**需要单独备份**。

<!-- readme-section: documentation -->
## 文档入口

| 文档 | 用途 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 从 SKILL 生成的 Agent 项目入口与规范导航 |
| [SKILL.md](SKILL.md) | 内容组织、资料核查、视觉与交付规范 |
| [制作与构建指南](handbook/authoring.md) | 主题清单、首次导入、HTML 编辑、资源打包与网站模式 |
| [维护与验证指南](handbook/maintenance.md) | 依赖约束、回归测试、浏览器验收与代码结构 |
| [本地主题数据](content/README.md) | 主题文件的存放与恢复 |

<!-- readme-section: style-example -->
## 样式示例

https://jyx114514.github.io/personal-html-book/example.html

<!-- readme-section: style-comparison -->
## 样式AB测（内容不同）

https://jyx114514.github.io/personal-html-book/qpcr-ct-gpt6.1.html

https://jyx114514.github.io/personal-html-book/rt-qpcr-ct-deepseek4.1.html

<!-- readme-section: license -->
## 许可

项目代码与规范采用 [CC BY-NC 4.0](LICENSE) 许可。输入材料和引用资源遵循各自的许可。
