# 教材编辑入口

项目用途见 [README](../README.md)，主题清单格式与构建操作见[制作指南](../handbook/authoring.md)。

本目录仅跟踪这份使用说明。所有主题目录（包括 `manifest.json` 与历史 Markdown）均保留在本地，由 `.gitignore` 排除。
新克隆的仓库不包含主题数据。构建前，先从自己的备份恢复 `content/<topic>/manifest.json` 和 `dist/<topic>.html`；首次从 Markdown 导入时，还需提供清单中的章节文件。请单独备份这些本地内容，Git 不负责保存它们。

独立教材的正文权威版本为 `dist/<topic>.html`。直接编辑 HTML 中的标题、段落、列表、表格、代码和参考文献，保存后刷新浏览器即可。

本目录的 Markdown 是迁移前的兼容输入，保留作历史参考；迁移完成后不再编辑它们来更新已交付教材。`manifest.json` 继续保存主题元数据和历史章节顺序。

`pnpm run build:standalone` 会刷新已有 HTML 的内嵌共享资源并保留正文。`pnpm run build:standalone <topic> --from-markdown` 会重新从历史 Markdown 导入并替换正文，只在明确需要恢复或重新迁移时使用。导出前的文件保存在私有目录 `internal/html-export-backups/`。

请保留 HTML 内的 `course:body:start` / `course:body:end` 标记。复杂实验的算法与动态模板在共享组件中维护；数学 SVG 与 `data-tex` 源码需要同步更新。
