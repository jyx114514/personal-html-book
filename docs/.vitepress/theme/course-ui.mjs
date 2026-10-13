// Shared labels for the standalone shell; textbook prose is never translated.
const messages = {
  zh: {
    outline: '教材目录', heading: '阅读目录', expand: '展开目录', collapse: '收起目录',
    navigation: '章节导航', table: '可横向滚动的数据表', copy: '复制代码',
  },
  en: {
    outline: 'Textbook outline', heading: 'Contents', expand: 'Expand contents', collapse: 'Collapse contents',
    navigation: 'Chapter navigation', table: 'Scrollable data table', copy: 'Copy code',
  },
}
/** @param {string} lang */
export function courseUi(lang) {
  return messages[/^zh(?:-|$)/i.test(lang) ? 'zh' : 'en']
}
