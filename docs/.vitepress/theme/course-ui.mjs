// Shared labels for the standalone shell; textbook prose is never translated.
const messages = {
  zh: {
    outline: '教材目录', heading: '阅读目录', expand: '展开目录', collapse: '收起目录',
    navigation: '章节导航', table: '可横向滚动的数据表', copy: '复制代码',
    copied: '已复制', copySelected: '代码已选中，请按 Ctrl+C 或 ⌘C 复制。', copyFailed: '无法复制代码，请手动选择并复制。',
  },
  en: {
    outline: 'Textbook outline', heading: 'Contents', expand: 'Expand contents', collapse: 'Collapse contents',
    navigation: 'Chapter navigation', table: 'Scrollable data table', copy: 'Copy code',
    copied: 'Copied', copySelected: 'Code selected. Press Ctrl+C or ⌘C to copy.', copyFailed: 'Unable to copy code. Select and copy it manually.',
  },
}
/** @param {string} lang */
export function courseUi(lang) {
  return messages[/^zh(?:-|$)/i.test(lang) ? 'zh' : 'en']
}
