import OmicsLab from './components/OmicsLab.vue'
import ComputerLab from './components/ComputerLab.vue'
import CourseOutline from './components/CourseOutline.vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useRoute } from 'vitepress'
import { onMounted, onUnmounted, watch } from 'vue'
import { mountDiagrams } from './diagrams'
import { mountGeneViewers } from './gene-viewer'
import GradientDemo from './components/GradientDemo.vue'
import CoursePanel from './components/CoursePanel.vue'
import './custom.css'
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('OmicsLab', OmicsLab)
    app.component('ComputerLab', ComputerLab)
    app.component('CourseOutline', CourseOutline)
    app.component('GradientDemo', GradientDemo)
    app.component('CoursePanel', CoursePanel)
  },
  setup() {
    const route = useRoute()
    let cleanup = () => {}
    const mount = () => {
      cleanup()
      const diagrams = mountDiagrams(document), genes = mountGeneViewers(document)
      cleanup = () => { diagrams(); genes() }
    }
    onMounted(mount)
    watch(() => route.path, mount, { flush: 'post' })
    onUnmounted(() => cleanup())
  },
} satisfies Theme
