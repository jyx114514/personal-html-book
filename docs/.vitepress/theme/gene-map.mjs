// Native SVG map geometry. Coordinates remain 1-based/inclusive in feature data;
// only the drawing uses zero-based boundaries and radians.
const tau = 2 * Math.PI
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const lengthOf = (feature, length) => feature.end >= feature.start ? feature.end - feature.start + 1 : length - feature.start + feature.end + 1
const round = number => Number(number.toFixed(3))
const textWidth = text => Array.from(text).reduce((width, char) => width + (/[^\u0000-\u00ff]/.test(char) ? 14 : 7.4), 0)
const segments = (feature, length) => feature.start <= feature.end ? [[feature.start - 1, feature.end]] : [[feature.start - 1, length], [0, feature.end]]
let mapSerial = 0
const mapNamespace = Math.random().toString(36).slice(2, 10)

export function planCircularMap(gene) {
  const length = gene.sequence.length
  const lanes = [], records = []
  // Put large features on the outer tracks; overlapping ranges get their own
  // track. Track assignment is geometric rather than based on input index.
  for (const index of gene.features.map((_, index) => index).sort((a, b) => lengthOf(gene.features[b], length) - lengthOf(gene.features[a], length) || a - b)) {
    const feature = gene.features[index]
    const ranges = segments(feature, length)
    let lane = lanes.findIndex(occupied => !ranges.some(([a, b]) => occupied.some(([c, d]) => a < d + length / 1440 && b > c - length / 1440)))
    if (lane < 0) { lane = lanes.length; lanes.push([]) }
    lanes[lane].push(...ranges)
    records.push({ index, feature, lane, size: lengthOf(feature, length) })
  }
  const spacing = Math.min(32, 210 / Math.max(1, lanes.length - 1))
  const thickness = Math.min(20, spacing * .68)
  for (const record of records) {
    record.radius = 356 - record.lane * spacing
    record.start = (record.feature.start - 1) / length * tau - Math.PI / 2
    record.end = record.start + record.size / length * tau
    record.middle = (record.start + record.end) / 2
    record.inside = record.size / length * tau * record.radius >= textWidth(record.feature.name) + 30 && record.size < length * .7
    record.side = Math.cos(record.middle) >= 0 ? 'right' : 'left'
  }
  const outside = records.filter(record => !record.inside)
  const left = outside.filter(record => record.side === 'left'), right = outside.filter(record => record.side === 'right')
  const height = Math.max(1200, Math.max(left.length, right.length) * 32 + 100)
  const center = { x: 700, y: height / 2 }
  for (const side of [left, right]) {
    side.sort((a, b) => Math.sin(a.middle) - Math.sin(b.middle) || a.index - b.index)
    for (let i = 0; i < side.length; i++) side[i].labelY = Math.max(50 + i * 32, center.y + Math.sin(side[i].middle) * 440, i ? side[i - 1].labelY + 32 : 50)
    for (let i = side.length - 1; i >= 0; i--) side[i].labelY = Math.min(side[i].labelY, height - 50 - (side.length - i - 1) * 32, i + 1 < side.length ? side[i + 1].labelY - 32 : height - 50)
  }
  return { records: records.sort((a, b) => a.index - b.index), center, height, thickness }
}

function circularMap(gene) {
  const plan = planCircularMap(gene)
  const { center, height, thickness } = plan
  const point = (angle, radius) => [round(center.x + Math.cos(angle) * radius), round(center.y + Math.sin(angle) * radius)]
  function arc(from, to, radius) {
    const parts = Math.max(1, Math.ceil(Math.abs(to - from) / Math.PI))
    return Array.from({ length: parts }, (_, index) => `A${round(radius)},${round(radius)} 0 0 ${to >= from ? 1 : 0} ${point(from + (to - from) * (index + 1) / parts, radius)}`).join(' ')
  }
  const prefix = `gene-map-${mapNamespace}-${++mapSerial}`
  const shapes = [], callouts = []
  for (const record of plan.records) {
    const { feature, radius, start, end, middle, index } = record
    const color = feature.color ?? ['#a8dba8', '#f2d59e', '#c5d9e3'][feature.tone ?? index % 3]
    let path
    if (!feature.strand) {
      path = `M${point(start, radius + thickness / 2)} ${arc(start, end, radius + thickness / 2)} L${point(end, radius - thickness / 2)} ${arc(end, start, radius - thickness / 2)} Z`
    } else {
      const head = Math.min((end - start) * .4, 16 / radius)
      const tail = feature.strand === 1 ? start : end, tip = feature.strand === 1 ? end : start
      const base = tip - feature.strand * head
      path = `M${point(tail, radius + thickness * .36)} ${arc(tail, base, radius + thickness * .36)} L${point(base, radius + thickness * .72)} L${point(tip, radius)} L${point(base, radius - thickness * .72)} L${point(base, radius - thickness * .36)} ${arc(base, tail, radius - thickness * .36)} Z`
    }
    let label = ''
    if (record.inside) {
      const reverse = Math.sin(middle) > 0
      const guide = `${prefix}-${index}`
      label = `<defs><path id="${guide}" d="M${point(reverse ? end : start, radius)} ${arc(reverse ? end : start, reverse ? start : end, radius)}"/></defs><text class="gene-map-inside" dy="4.5" data-gene-map-label="${index}"><textPath href="#${guide}" startOffset="50%" text-anchor="middle">${escape(feature.name)}</textPath></text>`
    } else {
      const right = record.side === 'right', x = right ? 1130 : 270
      const a = point(middle, radius + thickness / 2), b = point(middle, 407)
      const lineEnd = right ? x - 8 : x + 8
      callouts.push(`<g class="gene-feature gene-callout gene-tone-${feature.tone ?? index % 3}" data-gene-feature="${index}"><title>${escape(feature.name)} · ${feature.start}–${feature.end}</title><path class="gene-leader" d="M${a} L${b} L${lineEnd},${round(record.labelY)}"/><text x="${x}" y="${round(record.labelY - 3)}" text-anchor="${right ? 'start' : 'end'}" data-gene-map-label="${index}">${escape(feature.name)}<tspan class="gene-map-range" x="${x}" dy="14">${feature.start.toLocaleString('en-US')}–${feature.end.toLocaleString('en-US')}</tspan></text></g>`)
    }
    shapes.push(`<g class="gene-feature gene-tone-${feature.tone ?? index % 3}" data-gene-feature="${index}"><title>${escape(feature.name)} · ${feature.start}–${feature.end}</title><path class="gene-arc ${feature.strand ? 'gene-arrow' : 'gene-block'}" fill="${color}" d="${path}"/>${label}</g>`)
  }
  const length = gene.sequence.length
  const roughStep = length / 8, power = 10 ** Math.floor(Math.log10(Math.max(1, roughStep)))
  const step = Math.max(1, [1, 2, 5, 10].map(multiplier => multiplier * power).find(value => value >= roughStep))
  const ticks = []
  for (let position = 0; position < length; position += step) {
    const angle = position / length * tau - Math.PI / 2
    const a = point(angle, 382), b = point(angle, 398), text = point(angle, 373)
    let rotation = position / length * 360
    if (rotation > 90 && rotation < 270) rotation += 180
    ticks.push(`<path class="gene-map-tick" d="M${a} L${b}"/><text class="gene-map-coordinate" transform="translate(${text}) rotate(${round(rotation)})" text-anchor="middle">${position.toLocaleString('en-US')}</text>`)
  }
  const name = escape(gene.name)
  const fontSize = Math.max(12, Math.min(23, 350 / Math.max(1, textWidth(gene.name)) * 14))
  return `<svg class="gene-detailed-map" font-size="14" viewBox="0 0 1400 ${height}" role="img" aria-label="${name} · 环形图"><title>${name} · ${length} bp · 环形质粒图谱</title><desc>双线圆环表示序列骨架；填色箭头表示有方向的注释，无方向特征用色块表示。特征名称位于弧内或通过引线连接；左右标签已避让。坐标和注释来自输入数据。</desc><circle class="gene-backbone" cx="${center.x}" cy="${center.y}" r="390"/><circle class="gene-backbone" cx="${center.x}" cy="${center.y}" r="384"/>${ticks.join('')}<text class="gene-map-name" x="${center.x}" y="${center.y - 8}" text-anchor="middle" font-size="${round(fontSize)}">${name}</text><text class="gene-map-length" x="${center.x}" y="${center.y + 20}" text-anchor="middle">${length.toLocaleString('en-US')} bp</text>${shapes.join('\n')}${callouts.join('\n')}</svg>`
}

function linearMap(gene) {
  const length = gene.sequence.length, top = 100, rowHeight = 32
  const height = Math.max(240, top + gene.features.length * rowHeight + 70)
  const x = position => round(310 + position / length * 1040)
  const shapes = gene.features.map((feature, index) => {
    const y = top + index * rowHeight
    const color = feature.color ?? ['#a8dba8', '#f2d59e', '#c5d9e3'][feature.tone ?? index % 3]
    const blocks = segments(feature, length).map(([start, end]) => {
      const a = x(start), b = x(end), head = Math.min(12, (b - a) * .4)
      const path = feature.strand === 1 ? `M${a},${y - 7} H${b - head} V${y - 12} L${b},${y} L${b - head},${y + 12} V${y + 7} H${a} Z` : feature.strand === -1 ? `M${b},${y - 7} H${a + head} V${y - 12} L${a},${y} L${a + head},${y + 12} V${y + 7} H${b} Z` : `M${a},${y - 9} H${b} V${y + 9} H${a} Z`
      return `<path class="gene-arc ${feature.strand ? 'gene-arrow' : 'gene-block'}" fill="${color}" d="${path}"/>`
    }).join('')
    return `<g class="gene-feature gene-tone-${feature.tone ?? index % 3}" data-gene-feature="${index}"><title>${escape(feature.name)} · ${feature.start}–${feature.end}</title><path class="gene-linear-guide" d="M310,${y} H1350"/><text x="285" y="${y + 4}" text-anchor="end" data-gene-map-label="${index}">${escape(feature.name)}</text>${blocks}</g>`
  }).join('')
  return `<svg class="gene-detailed-map" font-size="14" viewBox="0 0 1400 ${height}" role="img" aria-label="${escape(gene.name)} · 线性图"><title>${escape(gene.name)} · ${length} bp</title><text class="gene-map-name" x="700" y="30" text-anchor="middle" font-size="23">${escape(gene.name)}</text><path class="gene-backbone" d="M310 60 H1350 M310 65 H1350"/><text class="gene-map-coordinate" x="310" y="84">1</text><text class="gene-map-coordinate" x="1350" y="84" text-anchor="end">${length.toLocaleString('en-US')} bp</text>${shapes}</svg>`
}

export const renderPlasmidMap = (gene, view = gene.topology) => view === 'circular' ? circularMap(gene) : linearMap(gene)
