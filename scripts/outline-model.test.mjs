import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildOutlineTree, renderOutlineTree } from '../docs/.vitepress/theme/outline-model.mjs'

test('outline nesting follows heading levels, including skipped levels and parent changes', () => {
  const items = [
    { href: '#a', title: 'Chapter A', level: 2 },
    { href: '#b', title: 'Detail B', level: 3 },
    { href: '#c', title: 'Deep C', level: 5 },
    { href: '#d', title: 'Detail D', level: 3 },
    { href: '#e', title: 'Chapter E', level: 2 },
  ]
  const tree = buildOutlineTree(items)
  assert.deepEqual(tree.map(item => item.href), ['#a', '#e'])
  assert.deepEqual(tree[0].children.map(item => item.href), ['#b', '#d'])
  assert.equal(tree[0].children[0].children[0].href, '#c')
  const html = renderOutlineTree(tree)
  assert.equal([...html.matchAll(/<details class="outline-branch">/g)].length, 2)
  assert.match(html, /<summary><a href="#a">Chapter A<\/a><\/summary><ol>/)
  assert.match(html, /<li><a href="#e">Chapter E<\/a><\/li>/)
})

test('native outline markup escapes labels and anchors and leaves leaf links accessible', () => {
  assert.equal(renderOutlineTree(buildOutlineTree([{ href: '#a"', title: '<Example> & title', level: 3 }])), '<li><a href="#a&quot;">&lt;Example&gt; &amp; title</a></li>')
})
