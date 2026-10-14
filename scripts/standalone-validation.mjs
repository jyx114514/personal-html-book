import { createRequire } from 'node:module'

// Reuse the parsers already shipped with Vue and Vite; no browser or extra install.
const vueRequire = createRequire(import.meta.resolve('vue/compiler-sfc'))
const viteRequire = createRequire(import.meta.resolve('vite'))
const { parse: parseHtml } = vueRequire('@vue/compiler-dom')
const postcss = viteRequire('postcss')

function assertInline(value, location) {
  if (!/^(?:data:|#)/i.test(value.trim())) {
    throw new Error(`External resource reference (${location}): ${value.slice(0, 160)}`)
  }
}

function checkCss(css, location) {
  const tree = postcss.parse(css)
  // Decode CSS escapes before looking for resource functions (e.g. u\\72l).
  const decode = value => value.replace(/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\r\n\f])/gi,
    (_, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16) || 0xfffd) : char)
  function checkValue(raw) {
    const value = decode(raw.replace(/\/\*[\s\S]*?\*\//g, ''))
    for (const match of value.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      assertInline(match[1] ?? match[2] ?? match[3], location)
    }
    // image-set also accepts bare strings instead of url(...).
    if (/(?:-webkit-)?image-set\s*\(/i.test(value)) {
      for (const match of value.matchAll(/(?:"([^"]*)"|'([^']*)')/g)) {
        const text = match[1] ?? match[2]
        if (!/^image\/[a-z0-9.+-]+$/i.test(text)) assertInline(text, location)
      }
    }
  }
  tree.walkDecls(declaration => checkValue(declaration.value))
  tree.walkAtRules(rule => {
    if (decode(rule.name).toLowerCase() === 'import') {
      throw new Error(`External resource reference (${location}): CSS @import must be inlined`)
    }
    checkValue(rule.params)
  })
}

export function assertStandaloneResources(html) {
  const tree = parseHtml(html, { parseMode: 'html' })
  function visit(node) {
    if (node.type === 1) {
      const tag = node.tag.toLowerCase()
      const attrs = new Map(node.props.filter(prop => prop.type === 6)
        .map(prop => [prop.name.toLowerCase(), prop.value?.content ?? '']))
      if (tag === 'base' || tag === 'iframe' || tag === 'embed' || tag === 'object') {
        throw new Error(`External resource reference: <${tag}> is not supported in standalone HTML`)
      }
      if (tag === 'meta' && attrs.get('http-equiv')?.toLowerCase() === 'refresh') {
        throw new Error('External resource reference: meta refresh is not supported')
      }
      if (tag === 'meta' && /^(?:og:(?:image|video|audio)(?::url|:secure_url)?|twitter:(?:image|player))$/i.test(attrs.get('property') ?? attrs.get('name') ?? '')) assertInline(attrs.get('content') ?? '', 'meta[content]')
      // cite is a bibliographic link, not an automatically loaded resource.
      for (const [name, value] of attrs) {
        if (name === 'style') checkCss(`element { ${value} }`, `${tag}[style]`)
        else if (node.ns === 1 && ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker', 'marker-start', 'marker-mid', 'marker-end', 'cursor', 'color-profile'].includes(name)) {
          checkCss(`element { ${name}: ${value} }`, `${tag}[${name}]`)
        } else if (node.ns === 1 && ['animate', 'set'].includes(tag) &&
          /^(?:href|xlink:href|src)$/i.test(attrs.get('attributename') ?? '') && ['from', 'to', 'by', 'values'].includes(name)) {
          for (const reference of value.split(';')) assertInline(reference, `${tag}[${name}]`)
        } else if (node.ns === 1 && ['animate', 'set'].includes(tag) &&
          /^(?:fill|stroke|filter|clip-path|mask|marker(?:-start|-mid|-end)?|cursor|color-profile)$/i.test(attrs.get('attributename') ?? '') && ['from', 'to', 'by', 'values'].includes(name)) {
          for (const item of value.split(';')) checkCss(`element { ${attrs.get('attributename')}: ${item} }`, `${tag}[${name}]`)
        } else if (name === 'srcset' || name === 'imagesrcset') {
          // Whitespace ends a URL token; commas inside a data URL belong to it.
          let rest = value.trim()
          while (rest) {
            rest = rest.replace(/^[\s,]+/, '')
            if (!rest) break
            const url = rest.match(/^\S+/)[0]
            assertInline(url.replace(/,+$/, ''), `${tag}[${name}]`)
            rest = rest.slice(url.length)
            if (!url.endsWith(',')) rest = rest.replace(/^[^,]*(?:,|$)/, '')
          }
        } else if (name === 'action' || name === 'formaction' || name === 'longdesc' || name === 'src' || name === 'poster' || name === 'background' ||
          ((name === 'href' || name === 'xlink:href') && !['a', 'area'].includes(tag))) {
          assertInline(value, `${tag}[${name}]`)
        }
      }
      if (tag === 'style') checkCss(node.children.map(child => child.content ?? '').join(''), '<style>')
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
}
