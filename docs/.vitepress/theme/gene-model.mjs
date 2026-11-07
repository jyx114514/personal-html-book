/** Coordinates are 1-based and inclusive, on the supplied forward strand. */
export function normalizeGene(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('gene-viewer: 数据必须是对象')
  if (typeof input.sequence !== 'string') throw new Error('gene-viewer: 缺少 sequence')
  const sequence = parseDna(input.sequence)
  const topology = input.topology ?? 'circular'
  if (!['circular', 'linear'].includes(topology)) throw new Error('gene-viewer: topology 必须是 circular 或 linear')
  if (input.features !== undefined && !Array.isArray(input.features)) throw new Error('gene-viewer: features 必须是数组')
  const features = (input.features ?? []).map((feature, index) => {
    if (!feature || typeof feature.name !== 'string' || !feature.name.trim()) throw new Error('gene-viewer: 注释需要 name')
    const { start, end } = feature
    if (![start, end].every(n => Number.isInteger(n) && n >= 1 && n <= sequence.length) || (start > end && topology !== 'circular')) throw new Error('gene-viewer: 注释坐标越界或跨越线性序列终点')
    if (feature.strand !== undefined && ![1, -1, 0].includes(feature.strand)) throw new Error('gene-viewer: strand 必须是 1、-1 或 0（无方向）')
    return { name: feature.name.trim(), start, end, strand: feature.strand ?? 1, description: String(feature.description ?? ''), tone: index % 3 }
  })
  if (features.length > 200) throw new Error('gene-viewer: 最多支持 200 条注释')
  return { name: String(input.name ?? 'DNA sequence'), sequence, topology, features }
}

export function parseDna(source) {
  const lines = source.trim().split(/\r?\n/)
  const headers = lines.filter(line => line.trim().startsWith('>'))
  if (headers.length > 1 || (headers.length && !lines[0].startsWith('>'))) throw new Error('gene-viewer: 每次只接受一条 FASTA 序列')
  const sequence = lines.filter(line => !line.startsWith('>')).join('').replace(/\s/g, '').toUpperCase()
  if (!sequence || !/^[ACGTRYSWKMBDHVN]+$/.test(sequence)) throw new Error('gene-viewer: 请使用 DNA IUPAC 字母（ACGT / RYSWKMBDHVN）')
  if (sequence.length > 50000) throw new Error('gene-viewer: 最多支持 50,000 bp')
  return sequence
}

const complement = { A: 'T', T: 'A', C: 'G', G: 'C', R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K', B: 'V', V: 'B', D: 'H', H: 'D', N: 'N' }
export const reverseComplement = sequence => Array.from(sequence, base => complement[base]).reverse().join('')
export const featureLength = (feature, length) => feature.end >= feature.start ? feature.end - feature.start + 1 : length - feature.start + feature.end + 1
export const selectedSequence = (sequence, start, end) => start <= end ? sequence.slice(start - 1, end) : sequence.slice(start - 1) + sequence.slice(0, end)
export const inRange = (position, start, end) => start <= end ? position >= start && position <= end : position >= start || position <= end
export const strandLabel = strand => strand === 1 ? '→' : strand === -1 ? '←' : '无方向'
export const escapeGene = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

export function renderGeneMap(gene, view = gene.topology) {
  const { sequence, features } = gene
  const length = sequence.length
  const circular = view === 'circular'
  const point = (position, radius) => {
    const angle = position / length * Math.PI * 2 - Math.PI / 2
    return [300 + Math.cos(angle) * radius, 185 + Math.sin(angle) * radius]
  }
  const shapes = features.map((feature, index) => {
    const size = featureLength(feature, length)
    const label = `${feature.name} · ${feature.start}–${feature.end} · ${strandLabel(feature.strand)}`
    const segments = feature.start <= feature.end ? [[feature.start - 1, feature.end]] : [[feature.start - 1, length], [0, feature.end]]
    let paths
    if (circular) {
      const radius = 114 - index % 3 * 16
      // Split full circles as SVG arc endpoints cannot be identical.
      const start = feature.start - 1, middle = start + size / 2, end = start + size
      const a = point(start, radius), b = point(middle, radius), c = point(end, radius)
      paths = `<path d="M${a} A${radius},${radius} 0 0 1 ${b} A${radius},${radius} 0 0 1 ${c}"/>`
      const tip = point(feature.strand === 1 ? end : start, radius)
      const tangent = (feature.strand === 1 ? end : start) / length * 360 + (feature.strand === 1 ? 0 : 180)
      const arrowScale = Math.min(1, size / length * Math.PI * 2 * radius / 12)
      if (feature.strand) paths += `<path class="gene-arrow" d="M-9,-7 L3,0 L-9,7 Z" transform="translate(${tip}) rotate(${tangent}) scale(${arrowScale})"/>`
    } else {
      const y = 95 + index % 5 * 32
      paths = segments.map(([start, end]) => `<path d="M${40 + start / length * 520},${y} H${40 + end / length * 520}"/>`).join('')
      const x = 40 + (feature.strand === 1 ? feature.end : feature.start - 1) / length * 520
      const arrowScale = Math.min(1, size / length * 520 / 12)
      if (feature.strand) paths += `<path class="gene-arrow" d="M-9,-7 L3,0 L-9,7 Z" transform="translate(${x},${y}) rotate(${feature.strand === 1 ? 0 : 180}) scale(${arrowScale})"/>`
    }
    return `<g data-gene-feature="${index}" class="gene-feature gene-tone-${feature.tone}"><title>${escapeGene(label)}</title>${paths}</g>`
  }).join('\n')
  const ticks = Array.from({ length: 4 }, (_, i) => {
    const position = i * length / 4
    if (!circular) return `<text x="${40 + i * 520 / 3}" y="285" text-anchor="middle">${Math.max(1, Math.round(i * length / 3))}</text>`
    const [x, y] = point(position, 153)
    return `<text x="${x}" y="${y + 5}" text-anchor="middle">${Math.max(1, Math.round(position))}</text>`
  }).join('')
  return `<svg viewBox="${circular ? '120 15 360 340' : '0 0 600 370'}" role="img" aria-label="${escapeGene(gene.name)} · ${circular ? '环形图' : '线性图'}"><title>${escapeGene(gene.name)} · ${length} bp</title>${circular ? '<circle class="gene-backbone" cx="300" cy="185" r="130"/>' : '<path class="gene-backbone" d="M40 65 H560"/>'}${ticks}${shapes}<text class="gene-map-name" x="300" y="${circular ? 181 : 325}" text-anchor="middle">${length.toLocaleString('en-US')} bp</text><text x="300" y="${circular ? 205 : 348}" text-anchor="middle">${circular ? 'CIRCULAR' : 'LINEAR'}</text></svg>`
}

export function renderGeneSequence(sequence, offset = 0, end = Math.min(sequence.length, offset + 600)) {
  const rows = []
  for (let start = offset; start < end; start += 60) {
    const bases = sequence.slice(start, Math.min(start + 60, end))
    const baseMarkup = Array.from(bases, (base, i) => `<span data-gene-position="${start + i + 1}">${base}</span>`).join('')
    rows.push(`<div class="gene-sequence-row"><span class="gene-coordinate">${start + 1}</span><div><div class="gene-forward">${baseMarkup}</div><div class="gene-complement" aria-label="互补链 3′ 到 5′">${Array.from(bases, base => `<span>${complement[base]}</span>`).join('')}</div></div><span class="gene-coordinate">${start + bases.length}</span></div>`)
  }
  return rows.join('\n')
}

export function renderGeneViewer(input) {
  const gene = normalizeGene(input)
  const { sequence, features } = gene
  const gc = (sequence.match(/[GC]/g) ?? []).length / sequence.length * 100
  return `<section class="gene-viewer" data-gene-viewer data-course-outline="exclude" data-topology="${gene.topology}">
<header class="gene-header"><div><div class="eyebrow">SEQUENCE EXPLORER</div><h3 data-gene-name>${escapeGene(gene.name)}</h3></div><span class="gene-badge">${sequence.length.toLocaleString('en-US')} bp · GC ${gc.toFixed(1)}%</span></header>
<p class="gene-help">坐标从 1 开始，包含两端；箭头表示注释方向。点击注释查看对应序列，或依次点击两个碱基选择范围。</p>
<div class="gene-controls" data-gene-controls hidden><div class="gene-views" role="group" aria-label="图谱视图"><button type="button" data-gene-view="circular" aria-pressed="${gene.topology === 'circular'}">环形图</button><button type="button" data-gene-view="linear" aria-pressed="${gene.topology === 'linear'}">线性图</button></div><label>搜索序列 <input type="search" data-gene-search placeholder="ACGT…" maxlength="50000"></label><button type="button" data-gene-next>下一个匹配</button></div>
<div class="gene-overview"><div class="gene-map" data-gene-map>${renderGeneMap(gene)}</div><div class="gene-annotations"><div class="gene-label">功能注释 · ${features.length}</div><ol>${features.map((feature, i) => `<li class="gene-tone-${feature.tone}" data-gene-annotation="${i}" data-start="${feature.start}" data-end="${feature.end}" data-strand="${feature.strand}"><span class="gene-feature-name">${escapeGene(feature.name)}</span><span class="gene-feature-coordinates">${feature.start}–${feature.end} · ${strandLabel(feature.strand)} · ${featureLength(feature, sequence.length)} bp</span><span class="gene-feature-description">${escapeGene(feature.description)}</span></li>`).join('')}</ol>${features.length ? '' : '<p>暂无功能注释。</p>'}</div></div>
<details class="gene-source"><summary>完整序列 · ${sequence.length} bp · 5′ → 3′</summary><div data-gene-raw>${sequence}</div></details>
<div class="gene-sequence-panel"><div class="gene-sequence-heading"><span class="gene-label">双链序列 · 正链 5′ → 3′</span><div data-gene-controls hidden><button type="button" data-gene-previous-page aria-label="上一段序列">上一段</button><span data-gene-page>1–${Math.min(600, sequence.length)}</span><button type="button" data-gene-next-page aria-label="下一段序列">下一段</button></div></div><div class="gene-sequence-scroll" tabindex="0" aria-label="双链序列，可横向滚动"><div data-gene-sequence>${renderGeneSequence(sequence)}</div></div></div>
<div class="gene-selection" data-gene-controls hidden><label>起点 <input type="number" data-gene-start value="1" min="1" max="${sequence.length}"></label><label>终点 <input type="number" data-gene-end value="${Math.min(60, sequence.length)}" min="1" max="${sequence.length}"></label><button type="button" data-gene-select>选择范围</button><button type="button" data-gene-copy>复制选区</button><button type="button" data-gene-reverse>复制反向互补</button><button type="button" data-gene-reset>重置</button></div>
<p class="gene-status" data-gene-status role="status" aria-live="polite">显示前 ${Math.min(600, sequence.length)} bp；完整序列可在上方展开阅读。</p>
<textarea class="gene-copy-fallback" data-gene-copy-fallback aria-label="选区序列，请手动复制" readonly hidden></textarea>
</section>\n`
}
