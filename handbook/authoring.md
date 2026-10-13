# 制作与构建指南

[项目介绍](../README.md) · [维护与验证](maintenance.md)

<!-- readme-section: environment -->
## 环境与准备

使用 Node.js ≥ 22.13 和固定的 pnpm 10.26.0。依赖维护约束见[维护指南](maintenance.md)。

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
  "lang": "zh-CN",
  "output": "my-topic.html",
  "chapters": ["01-introduction.md"]
}
```

清单位于 `content/my-topic/manifest.json`；首次导入所需的章节放在同一目录。已有 HTML 的资源刷新仍需该主题清单，但不需要重新读取旧 Markdown。

<!-- readme-section: authoring -->
## 制作和编辑

`scripts/build-standalone.mjs` 在构建期将 Markdown 转成静态语义化 HTML，渲染公式、代码高亮和实验初值，复用共享主题，并内联全部资源。运行时 JavaScript 只增强目录、复制与实验交互，不重建正文。制作规范见 [SKILL.md](../SKILL.md)，它与 `.agents/skills/dialogue-to-course/SKILL.md` 必须同步。

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

不指定主题或使用 `--all` 时，导出器只处理 `dist/` 中已有主题；目录为空会提示准备本地数据并以非零退出码停止。首次构建需显式指定已经准备好的主题。

`dist/<topic>.html` 是正文的**唯一权威版本**。可直接编辑标题、段落、列表、表格、代码与参考文献，保存后刷新浏览器即可。保留唯一且有序的一对 `<!-- course:body:start -->` / `<!-- course:body:end -->` 标记。已有文件为空或标记缺失、重复、顺序错误时，构建器停止覆盖。默认重新导出保留正文；`--from-markdown` 会替换正文，旧文件备份到 `internal/html-export-backups/`。

修改公式的 `data-tex` 后，需要同步更新静态 SVG/MathML；仅修改 TeX 不会自动刷新公式显示。

目录保留桌面左侧固定布局与窄屏顶部折叠布局，根据正文的 H2–H6 生成层级。父标题可跳转，箭头或键盘可展开小标题；新导出的目录使用原生 `details`，关闭 JavaScript 仍可展开。实验容器内部的标题不进目录；自定义实验请使用 `data-course-outline="exclude"`。直接编写 HTML 时，为正文标题设置稳定且唯一的 `id`。资源刷新保留已有正文，运行时会增强旧的平面目录以支持子标题。

人工修订后的 HTML 继续作为唯一权威版本。后续追加时，读取当前文件，只在现有 `<article>` 的末尾、`</article>` 之前插入新内容；已有正文及人工修订保持原样，不重新排版或从旧 Markdown 重建。新增锚点避开所有已有 ID，目录仅追加新项目。除非明确要求修改既有内容，否则不改前面的章节。历史备份仅用于溯源，验收以当前 HTML 为基准，不要求与旧备份全文相同。

首次从 Markdown 导入多个章节时，统一生成唯一标题锚点。资源校验解析 HTML 属性和 CSS，拒绝未内嵌的图片、样式及其他资源；普通参考文献链接可以保留。外部图片须先转换为 data URL，校验不会自动下载资源。

Markdown 导入采用保守校验：原生 HTML 标签必须小写（例如 `<b>`，不能写 `<B>`），组件须来自白名单；正文中的 `<style>` 块会明确报错，请复用共享样式。代码块中的标签和样式示例不受此限制。每个公式在构建时校验 `data-tex` 注入与静态 SVG 的存在，输出结构不兼容会立即报错。

<!-- readme-section: language -->
## 语言

**正文语言不受限制**，中文、英文或其他语言均可：构建器不判断正文语言，也不翻译正文，资源校验只检查是否内联。正文使用共享无衬线字体栈，标题使用 Georgia、Times New Roman、宋体等衬线回退，均支持拉丁字母与汉字。

主题清单可指定 `"lang": "en"`，默认 `zh-CN`。首次导入时，它设置 `<html lang>` 和导出外壳的目录标题、导航标签、展开/收起按钮、表格与复制按钮标签。共享文案支持中文和英文；其他有效语言标记使用英文外壳，不翻译正文。

默认重新打包保留已有 HTML 的正文与 `lang`，不会改写人工修订的目录或表格。已有文件可直接修改 `<html lang>`、目录文本及按钮的 `data-expand-label` / `data-collapse-label`；复制按钮已有的 `aria-label` 也会保留。

内置实验 OmicsLab、ComputerLab、GradientDemo 和网站组件 CourseOutline 的内容仍为中文，实验不会自动翻译；`OmicsLab.vue` 的数字格式仍使用 `zh-CN`。网站模式的语言、标题与导航由 `docs/.vitepress/config.mts` 单独配置。

<!-- readme-section: delivery -->
## 本地交付

独立教材输出为 `dist/<topic>.html`，可直接编辑并离线使用。可选 VitePress 网站输出为 `docs/.vitepress/dist/`；本地构建路径通过环境变量 `SITE_BASE` 设置，域名根目录使用 `/`，子目录使用对应的路径。
