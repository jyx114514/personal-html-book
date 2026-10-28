import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { browserAdaptor } from 'mathjax-full/js/adaptors/browserAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { SafeHandler } from 'mathjax-full/js/ui/safe/SafeHandler.js'
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js'

// The exporter resolves the MathJax already installed by markdown-it-mathjax3.
// No loader, external fonts, HTML extension, or page-wide typesetting is used.
let engine
const cache = new Map()

/** @param {string} tex @param {boolean} display @returns {HTMLElement | null} */
export function renderNoteMath(tex, display) {
  if (tex.length > 4096) return null
  const key = `${display}:${tex}`
  if (cache.has(key)) return cache.get(key)?.cloneNode(true) ?? null
  let result = null
  try {
    if (!engine) {
      SafeHandler(RegisterHTMLHandler(browserAdaptor()))
      engine = mathjax.document(document, {
        InputJax: new TeX({ packages: ['base', 'ams'], maxBuffer: 4096, maxMacros: 256,
          formatError(_jax, error) { throw error } }),
        OutputJax: new SVG({ fontCache: 'none' }),
        safeOptions: { allow: { URLs: 'none', classes: 'none', cssIDs: 'none', styles: 'none' } },
      })
    }
    engine.inputJax[0].reset()
    result = engine.convert(tex, { display, em: 16, ex: 8, containerWidth: 640 })
    // Each cached expression is self-contained, including repeated copies.
    for (const node of result.querySelectorAll('[id]')) node.removeAttribute('id')
  } catch { /* An incomplete or unsupported formula stays readable as source. */ }
  if (cache.size >= 100) cache.delete(cache.keys().next().value)
  cache.set(key, result)
  return result?.cloneNode(true) ?? null
}
