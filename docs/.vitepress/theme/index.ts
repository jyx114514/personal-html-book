import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import GradientDemo from './components/GradientDemo.vue'
import CoursePanel from './components/CoursePanel.vue'
import './custom.css'
export default { extends:DefaultTheme, enhanceApp({app}) {app.component('GradientDemo',GradientDemo);app.component('CoursePanel',CoursePanel)} } satisfies Theme
