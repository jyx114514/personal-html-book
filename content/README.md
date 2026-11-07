# 教材编辑入口

项目用途见 [README](../README.md)，主题清单格式与构建操作见[制作指南](../handbook/authoring.md)。

本目录仅跟踪这份使用说明。所有主题目录（包括 `manifest.json` 与历史 Markdown）均保留在本地，由 `.gitignore` 排除。
新克隆的仓库不包含主题数据。构建前，先从自己的备份恢复 `content/<topic>/manifest.json` 和 `dist/<topic>.html`；首次从 Markdown 导入时，还需提供清单中的章节文件。请单独备份这些本地内容，Git 不负责保存它们。

独立教材的正文权威版本为 `dist/<topic>.html`。直接编辑 HTML 中的标题、段落、列表、表格、代码和参考文献，保存后刷新浏览器即可。

新主题沿用根目录 `example.html` 已确认的默认样式，包括宽屏自适应正文、层级目录、代码工具栏和段落笔记；需要序列讲解时复用共享 Gene 查看器。制作步骤与图谱数据格式见[制作指南](../handbook/authoring.md)，未经用户明确要求不另建主题样式。

本目录的 Markdown 是迁移前的兼容输入，保留作历史参考；迁移完成后不再编辑它们来更新已交付教材。`manifest.json` 继续保存主题元数据和历史章节顺序。

`pnpm run build:standalone` 会刷新已有 HTML 的内嵌共享资源并保留正文。`pnpm run build:standalone <topic> --from-markdown` 会重新从历史 Markdown 导入并替换正文，只在明确需要恢复或重新迁移时使用。导出前的文件保存在私有目录 `internal/html-export-backups/`。

请保留 HTML 内的 `course:body:start` / `course:body:end` 标记。复杂实验的算法与动态模板在共享组件中维护；数学 SVG 与 `data-tex` 源码需要同步更新。

质粒图谱的静态 SVG、序列和注释也属于当前 HTML。默认资源刷新不会重新生成图谱；需更新图谱布局时，应从当前 HTML 数据生成并替换对应片段，保留其他正文，再重新打包。
