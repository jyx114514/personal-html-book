import { normalizeGene, parseDna, renderGeneMap, renderGeneSequence, selectedSequence, reverseComplement, inRange, strandLabel } from './gene-model.mjs'
import './gene-viewer.css'

const mounted = new WeakSet<HTMLElement>()
type Feature = { name: string; start: number; end: number; strand: number; description: string; tone: number }

export function mountGeneViewers(root: ParentNode = document) {
  const cleanups: (() => void)[] = []
  for (const viewer of root.querySelectorAll<HTMLElement>('[data-gene-viewer]')) {
    if (mounted.has(viewer)) continue
    const get = <T extends HTMLElement>(selector: string) => viewer.querySelector<T>(selector)!
    let gene
    try {
      gene = normalizeGene({
        name: get('[data-gene-name]').textContent,
        sequence: parseDna(get('[data-gene-raw]').textContent ?? ''),
        topology: viewer.dataset.topology,
        features: Array.from(viewer.querySelectorAll<HTMLElement>('[data-gene-annotation]'), item => ({
          name: item.querySelector('.gene-feature-name')?.textContent,
          start: Number(item.dataset.start), end: Number(item.dataset.end), strand: Number(item.dataset.strand),
          description: item.querySelector('.gene-feature-description')?.textContent ?? '',
        })),
      })
    } catch (error) {
      get('[data-gene-status]').textContent = error instanceof Error ? error.message : String(error)
      continue
    }
    mounted.add(viewer)
    const controller = new AbortController()
    const listen = (target: EventTarget, event: string, handler: EventListener) => target.addEventListener(event, handler, { signal: controller.signal })
    const sequence = gene.sequence
    let view = gene.topology, offset = 0, start = 0, end = 0, anchor = 0, matchIndex = -1
    let matches: number[] = []
    let copyVersion = 0
    const report = (text: string) => { get('[data-gene-status]').textContent = text }
    const controls = viewer.querySelectorAll<HTMLElement>('[data-gene-controls]')
    controls.forEach(node => { node.hidden = false })
    const startInput = get<HTMLInputElement>('[data-gene-start]'), endInput = get<HTMLInputElement>('[data-gene-end]')
    const copy = get<HTMLButtonElement>('[data-gene-copy]'), reverse = get<HTMLButtonElement>('[data-gene-reverse]')
    copy.disabled = reverse.disabled = true
    const hideFallback = () => { get('[data-gene-copy-fallback]').hidden = true; copyVersion++ }
    const paint = () => {
      for (const base of viewer.querySelectorAll<HTMLElement>('[data-gene-position]')) {
        const position = Number(base.dataset.genePosition)
        base.classList.toggle('gene-selected', start > 0 && inRange(position, start, end))
      }
      for (const feature of viewer.querySelectorAll<HTMLElement>('[data-gene-annotation]')) {
        const selected = Number(feature.dataset.start) === start && Number(feature.dataset.end) === end
        feature.setAttribute('aria-pressed', String(selected))
      }
      for (const feature of viewer.querySelectorAll<SVGElement>('[data-gene-feature]')) {
        const data = gene.features[Number(feature.dataset.geneFeature)]
        feature.classList.toggle('gene-active', data.start === start && data.end === end)
      }
      get<HTMLButtonElement>('[data-gene-previous-page]').disabled = offset === 0
      get<HTMLButtonElement>('[data-gene-next-page]').disabled = offset + 600 >= sequence.length
    }
    const page = (nextOffset: number) => {
      offset = Math.max(0, Math.min(Math.floor((sequence.length - 1) / 600) * 600, nextOffset))
      get('[data-gene-sequence]').innerHTML = renderGeneSequence(sequence, offset)
      get('[data-gene-page]').textContent = `${offset + 1}–${Math.min(offset + 600, sequence.length)}`
      paint()
    }
    const select = (from: number, to: number, label = '') => {
      if (![from, to].every(value => Number.isInteger(value) && value >= 1 && value <= sequence.length) || (from > to && gene.topology === 'linear')) {
        report(`请输入 1–${sequence.length} 内的整数坐标；线性序列的起点不能大于终点。`)
        return
      }
      hideFallback()
      start = from; end = to
      startInput.value = String(start); endInput.value = String(end)
      copy.disabled = reverse.disabled = false
      page(Math.floor((start - 1) / 600) * 600)
      report(`${label ? label + ' · ' : ''}${start}–${end} · ${selectedSequence(sequence, start, end).length} bp${start > end ? ' · 跨越环形起点' : ''}`)
    }
    const chooseFeature = (index: number) => {
      const feature: Feature = gene.features[index]
      if (feature) { anchor = 0; select(feature.start, feature.end, `${feature.name} ${strandLabel(feature.strand)}`) }
    }
    const search = () => {
      const query = get<HTMLInputElement>('[data-gene-search]').value.replace(/\s/g, '').toUpperCase()
      matches = []; matchIndex = -1
      if (!query) { report('输入 DNA 字母搜索正链；IUPAC 字母按字面匹配。'); return }
      if (!/^[ACGTRYSWKMBDHVN]+$/.test(query) || query.length > sequence.length) { report('搜索无匹配：请使用不超过序列长度的 DNA 字母。'); return }
      const haystack = gene.topology === 'circular' ? sequence + sequence.slice(0, query.length - 1) : sequence
      for (let position = haystack.indexOf(query); position >= 0 && position < sequence.length; position = haystack.indexOf(query, position + 1)) matches.push(position)
      nextMatch(query.length)
    }
    const nextMatch = (queryLength = get<HTMLInputElement>('[data-gene-search]').value.replace(/\s/g, '').length) => {
      if (!matches.length) { report('搜索无匹配。'); return }
      matchIndex = (matchIndex + 1) % matches.length
      const position = matches[matchIndex]
      anchor = 0
      select(position + 1, (position + queryLength - 1) % sequence.length + 1, `匹配 ${matchIndex + 1}/${matches.length}`)
    }
    listen(get('[data-gene-search]'), 'input', search)
    listen(viewer, 'click', event => {
      const target = (event.target as Element).closest<HTMLElement>('[data-gene-view], [data-gene-feature], [data-gene-annotation], [data-gene-position], button')
      if (!target || !viewer.contains(target)) return
      if (target.dataset.geneView) {
        view = target.dataset.geneView
        get('[data-gene-map]').innerHTML = renderGeneMap(gene, view)
        viewer.querySelectorAll<HTMLElement>('[data-gene-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.geneView === view)))
        paint()
      } else if (target.dataset.geneFeature !== undefined || target.dataset.geneAnnotation !== undefined) {
        chooseFeature(Number(target.dataset.geneFeature ?? target.dataset.geneAnnotation))
      } else if (target.dataset.genePosition) {
        const position = Number(target.dataset.genePosition)
        if (!anchor) { anchor = position; select(position, position); report(`起点 ${position}；再点击一个碱基确定终点。`) }
        else { select(Math.min(anchor, position), Math.max(anchor, position)); anchor = 0 }
      } else if (target.hasAttribute('data-gene-select')) { anchor = 0; select(startInput.valueAsNumber, endInput.valueAsNumber) }
      else if (target.hasAttribute('data-gene-next')) nextMatch()
      else if (target.hasAttribute('data-gene-previous-page')) page(offset - 600)
      else if (target.hasAttribute('data-gene-next-page')) page(offset + 600)
      else if (target.hasAttribute('data-gene-reset')) {
        start = end = anchor = 0; matches = []; matchIndex = -1
        get<HTMLInputElement>('[data-gene-search]').value = ''
        startInput.value = '1'; endInput.value = String(Math.min(60, sequence.length))
        hideFallback(); copy.disabled = reverse.disabled = true
        page(0); report('已清除选区并回到序列起点。')
      } else if (target.hasAttribute('data-gene-copy') || target.hasAttribute('data-gene-reverse')) {
        if (!start) return
        const text = selectedSequence(sequence, start, end)
        const result = target.hasAttribute('data-gene-reverse') ? reverseComplement(text) : text
        const version = ++copyVersion
        void (async () => {
          try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
            await navigator.clipboard.writeText(result)
            if (version === copyVersion) report(`已复制 ${result.length} bp${target.hasAttribute('data-gene-reverse') ? ' 反向互补序列' : ''}。`)
          } catch {
            if (version !== copyVersion) return
            const fallback = get<HTMLTextAreaElement>('[data-gene-copy-fallback]')
            fallback.value = result; fallback.hidden = false; fallback.focus(); fallback.select()
            report('自动复制不可用；已选中序列，请按 Ctrl+C / ⌘C 复制。')
          }
        })()
      }
    })
    listen(viewer, 'keydown', event => {
      const key = event as KeyboardEvent
      const item = (key.target as Element).closest<HTMLElement>('[data-gene-annotation]')
      if (item && (key.key === 'Enter' || key.key === ' ')) { key.preventDefault(); chooseFeature(Number(item.dataset.geneAnnotation)) }
      if ((key.target === startInput || key.target === endInput) && key.key === 'Enter') { key.preventDefault(); anchor = 0; select(startInput.valueAsNumber, endInput.valueAsNumber) }
    })
    viewer.querySelectorAll<HTMLElement>('[data-gene-annotation]').forEach(item => { item.tabIndex = 0; item.setAttribute('role', 'button'); item.setAttribute('aria-pressed', 'false') })
    paint()
    cleanups.push(() => { controller.abort(); copyVersion++; mounted.delete(viewer) })
  }
  return () => cleanups.forEach(cleanup => cleanup())
}
