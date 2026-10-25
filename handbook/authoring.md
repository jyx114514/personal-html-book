# 制作与构建指南

[项目介绍](../README.md) · [维护与验证](maintenance.md)

<!-- readme-section: environment -->
## 环境与准备

使用 Node.js ≥ 22.13 和固定的 pnpm 10.26.0。依赖维护约束见[维护指南](maintenance.md)。

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

完整工作流验收包含强制离线浏览器夹具，浏览器准备见[维护指南](maintenance.md)。只有 `verify:static` 可以不启动浏览器，它不代表离线验收通过。具体教材完成构建后运行 `pnpm run verify:html`；夹具通过不能代替当前交付文件的验收。

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

`scripts/build-standalone.mjs` 在构建期将 Markdown 转成静态语义化 HTML，渲染公式、代码高亮和实验初值，复用共享主题，并内联全部资源。运行时 JavaScript 只增强目录、复制与实验交互，不重建正文。制作规范的唯一可编辑来源是根目录 [SKILL.md](../SKILL.md)；修改后运行 `pnpm run sync:agents`，生成 `AGENTS.md` 并同步 `.agents/skills/dialogue-to-course/SKILL.md`，验收会拒绝副本漂移。

导出器按当前 HTML 正文中的 `data-course-component` 标记打包所需的白名单实验组件；没有这些实验时仅打包原生目录、复制和图解脚本，不包含 Vue 实验运行时。默认资源刷新也会重新识别正文中的组件，因此直接在 HTML 中增删实验后，重新导出即可更新依赖，正文保持原样。

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

代码与文本框复用 `docs/.vitepress/theme/custom.css` 的统一工具栏：顶部独占一行（48px），左侧显示语言，右侧常驻“复制代码”文字按钮；代码在下一行显示并可横向滚动。复制成功时在原按钮内显示“已复制”，不弹出覆盖代码的提示。按钮保留可见键盘焦点，明暗模式与窄屏均不得遮挡内容，不恢复为悬停才出现的浮动图标。独立 HTML 通过默认 `build:standalone <topic>` 刷新内嵌共享资源即可采用此样式，正文原样保留；网站模式直接复用同一主题。验收需检查中英文文案、常驻可见性、按钮与代码不重叠，以及复制反馈的位置。

独立 HTML 同时支持高亮代码块和 `.code` / `.code-bar` 结构。剪贴板权限被拒绝或 API 不可用时，选中对应代码并在代码块下方提示使用 Ctrl+C 或 ⌘C；无法选中时显示手动复制提示。提示支持中英文与屏幕阅读器，不覆盖代码。浏览器回归实际点击按钮、读取剪贴板，并验证权限拒绝及 API 缺失时的反馈。

目录保留桌面左侧固定布局与窄屏顶部折叠布局，根据正文的 H2–H6 生成层级。父标题可跳转，箭头或键盘可展开小标题；新导出的目录使用原生 `details`，关闭 JavaScript 仍可展开。实验容器内部的标题不进目录；自定义实验请使用 `data-course-outline="exclude"`。直接编写 HTML 时，为正文标题设置稳定且唯一的 `id`。资源刷新保留已有正文，运行时会增强旧的平面目录以支持子标题。

人工修订后的 HTML 继续作为唯一权威版本。后续追加时，读取当前文件，只在现有 `<article>` 的末尾、`</article>` 之前插入新内容；已有正文及人工修订保持原样，不重新排版或从旧 Markdown 重建。新增锚点避开所有已有 ID，目录仅追加新项目。除非明确要求修改既有内容，否则不改前面的章节。历史备份仅用于溯源，验收以当前 HTML 为基准，不要求与旧备份全文相同。

首次从 Markdown 导入多个章节时，统一生成唯一标题锚点。资源校验解析 HTML 属性和 CSS，拒绝未内嵌的图片、样式及其他资源；普通参考文献链接可以保留。外部图片须先转换为 data URL，校验不会自动下载资源。

Markdown 导入采用保守校验：原生 HTML 标签必须小写（例如 `<b>`，不能写 `<B>`），组件须来自白名单；正文中的 `<style>` 块会明确报错，请复用共享样式。代码块中的标签和样式示例不受此限制。每个公式在构建时校验 `data-tex` 注入与静态 SVG 的存在，输出结构不兼容会立即报错。

<!-- readme-section: diagrams -->
## 原生讲解图片

在关系、流程或变化过程需要图解时，优先直接在正文中绘制内嵌 SVG；静态图无需脚本。图形属性负责几何布局，配色使用共享变量，图框、图注和按钮复用已有样式，不引入额外绘图库或依赖。每张图提供 `viewBox`、可访问名称与描述、图注，整份 HTML 的 ID 必须唯一。坐标与数值需有依据，概念示意图说明简化与非定量性质。复杂图可拆分，确保手机与深色模式可读。

下面的图默认静止，读者点击播放后展示信号沿路径移动；可暂停、继续、重置。`data-course-animation` 区域只放一个 SVG；所有 `animate`、`animateMotion`、`animateTransform` 和 `set` 必须用 `begin="indefinite"`，由共享原生脚本同时开始。不支持该结构或 SVG 动画时，控件保持隐藏。关闭 JavaScript 时动画不启动，系统要求减少动态效果时隐藏控件；页面进入后台时自动暂停。连续演示可以使用 `repeatCount="indefinite"`，设置固定周期；有限动画结束后可点击重置再播放。

```html
<figure data-course-animation>
  <svg id="signal-diagram" viewBox="0 0 360 120" role="img" aria-labelledby="signal-title" aria-describedby="signal-desc">
    <title id="signal-title">信号沿路径传播</title>
    <desc id="signal-desc">圆点从左侧输入移向右侧输出，箭头表示传播方向。示意，非定量结果。</desc>
    <defs>
      <marker id="signal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--muted)"></path>
      </marker>
    </defs>
    <path d="M 40 60 H 320" fill="none" stroke="var(--muted)" stroke-width="2" marker-end="url(#signal-arrow)"></path>
    <circle cx="40" cy="60" r="9" fill="var(--accent)">
      <animate attributeName="cx" from="40" to="320" dur="4s" begin="indefinite" repeatCount="indefinite"></animate>
    </circle>
    <text x="40" y="100" text-anchor="middle" font-size="24" fill="var(--ink)">输入</text>
    <text x="320" y="100" text-anchor="middle" font-size="24" fill="var(--ink)">输出</text>
  </svg>
  <div data-course-animation-controls hidden>
    <button class="reset" type="button" data-course-animation-play aria-controls="signal-diagram">播放 / 继续</button>
    <button class="reset" type="button" data-course-animation-pause aria-controls="signal-diagram" disabled>暂停</button>
    <button class="reset" type="button" data-course-animation-reset aria-controls="signal-diagram">重置</button>
  </div>
  <figcaption>从左向右读：输入 → 传播 → 输出。圆点表示信号，箭头表示方向；示意，非定量结果，4 秒周期仅为方便观察。</figcaption>
</figure>
```

只需要静态图时，移除示例中的 `animate`、控件和 `data-course-animation` 属性，保留 SVG 与图注。动画起点与静态属性保持一致；过程中的关键步骤和结论需同时用文字或静态分步图说明。更复杂的参数演示可以在独立区域使用原生 JavaScript；Canvas 绘图需提供静态 SVG/表格和文字替代。

SVG 的 `<use>`、`<image>` 和绘图属性只能引用内嵌资源；箭头、渐变、滤镜等使用当前文件中的 `#id` / `url(#id)`，不得引用外部 SVG 文件。资源校验也检查动画对链接、填充和滤镜等属性的修改，不会自动下载资源。默认重新打包原样保留 SVG 和图注；在已有教材中追加图解仍只追加到当前 `<article>` 末尾。

浏览器验收时，检查初始图、播放后的实际变化、暂停与继续、重置、键盘操作、关闭 JavaScript、减少动态效果、离线资源请求、深色模式和窄屏布局。实现参考：[SVG 动画控制](https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement)、[启动动画](https://developer.mozilla.org/en-US/docs/Web/API/SVGAnimationElement/beginElement)、[SVG 本地与资源引用](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/Linking)。

<!-- readme-section: language -->
## 语言

**正文语言不受限制**，中文、英文或其他语言均可：构建器不判断正文语言，也不翻译正文，资源校验只检查是否内联。正文使用共享无衬线字体栈，标题使用 Georgia、Times New Roman、宋体等衬线回退，均支持拉丁字母与汉字。

主题清单可指定 `"lang": "en"`，默认 `zh-CN`。首次导入时，它设置 `<html lang>` 和导出外壳的目录标题、导航标签、展开/收起按钮、表格与复制按钮标签。共享文案支持中文和英文；其他有效语言标记使用英文外壳，不翻译正文。

默认重新打包保留已有 HTML 的正文与 `lang`，不会改写人工修订的目录或表格。已有文件可直接修改 `<html lang>`、目录文本及按钮的 `data-expand-label` / `data-collapse-label`；复制按钮已有的 `aria-label` 也会保留。

内置实验 OmicsLab、ComputerLab、GradientDemo 和网站组件 CourseOutline 的内容仍为中文，实验不会自动翻译；`OmicsLab.vue` 的数字格式仍使用 `zh-CN`。网站模式的语言、标题与导航由 `docs/.vitepress/config.mts` 单独配置。

<!-- readme-section: delivery -->
## 本地交付

独立教材输出为 `dist/<topic>.html`，可直接编辑并离线使用。可选 VitePress 网站输出为 `docs/.vitepress/dist/`；本地构建路径通过环境变量 `SITE_BASE` 设置，域名根目录使用 `/`，子目录使用对应的路径。
