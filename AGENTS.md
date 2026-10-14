# Agent 项目指令

<!-- 由 SKILL.md 的 agent-entry 区块生成；修改规范源后运行 pnpm run sync:agents，禁止独立维护本副本。 -->

本项目将对话、科学笔记和本地计算流程整理为交互式 HTML 教材。处理章节任务前，阅读 `.agents/skills/dialogue-to-course/SKILL.md` 和 `handbook/authoring.md`。

- 内容组织、资料核查、隐私、固定学术视觉、HTML 正文权威版本和版本控制范围，以 `SKILL.md` 对应章节为准。
- 已有 HTML 的保护、末尾追加、原生静态/动态图解及构建操作，以 `handbook/authoring.md` 的“制作和编辑”“原生讲解图片”为准；操作前读取当前 HTML，不得用旧 Markdown 或历史备份覆盖人工修订。
- 验收分层、依赖与维护操作，以 `handbook/maintenance.md` 为准。本项目仅提供本地检查与构建，不启用 GitHub Actions。
- 工作流修订运行 `pnpm run verify`，必须包含离线浏览器夹具回归；`pnpm run verify:static` 只做静态检查，不能报告完整验收通过或离线可用。具体教材构建后运行 `pnpm run verify:html` 验证当前交付文件，夹具通过不能代替教材验收。缺少依赖或浏览器时完整验收必须失败，未执行项如实说明。

规范更新只修改根目录 `SKILL.md` 或对应手册，然后运行 `pnpm run sync:agents`。该命令生成本入口并同步 Skill 副本；`pnpm run verify` 自动检测副本及入口漂移。
