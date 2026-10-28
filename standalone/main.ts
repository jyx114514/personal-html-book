import { mountOutline } from '../docs/.vitepress/theme/outline'
import { mountDiagrams } from '../docs/.vitepress/theme/diagrams'
import { mountCopyButtons } from './copy'
import { mountAnnotations } from './annotations'
import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/base.css'
import 'vitepress/dist/client/theme-default/styles/components/vp-doc.css'
import '../docs/.vitepress/theme/custom.css'
import './layout.css'
import '../docs/.vitepress/theme/outline.css'

// The generated entry hydrates only the experiments present in the current body.
export function mountStandalone() {
  mountOutline(document)
  mountDiagrams(document)
  mountCopyButtons(document)
  mountAnnotations(document)
}
