import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../docs/.vitepress/theme/components/computerModels.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { interpretBits, decodeFloat32, layoutFields, addressOf, stackTrace } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
assert.deepEqual(interpretBits(255), { unsigned:255, signed:-1, binary:'11111111' })
assert.equal(interpretBits(128).signed,-128)
assert.equal(interpretBits(256).unsigned,0)
assert.equal(interpretBits(129).signed,-127)
assert.equal(decodeFloat32('1').hex,'3f800000')
assert.equal(decodeFloat32('0.1').hex,'3dcccccd')
assert.equal(decodeFloat32('-0').hex,'80000000')
assert.equal(decodeFloat32('1.401298464324817e-45').hex,'00000001')
assert.equal(decodeFloat32('1.401298464324817e-45').category,'非正规数')
assert.equal(decodeFloat32('16777217').result,16777216)
assert.equal(decodeFloat32('Infinity').hex,'7f800000')
assert.equal(decodeFloat32('NaN').category,'NaN')
const record = layoutFields([{name:'id',size:4,align:4},{name:'score',size:8,align:8},{name:'tag',size:1,align:1}])
assert.deepEqual(record.rows.map(r=>r.offset),[0,8,16])
assert.equal(record.size,24)
assert.equal(record.tail,7)
assert.equal(layoutFields([{name:'score',size:8,align:8},{name:'id',size:4,align:4},{name:'tag',size:1,align:1}]).size,16)
for(const longSize of [8,4]) {
  const node = layoutFields([{name:'id',size:longSize,align:longSize},{name:'flag',size:1,align:1},{name:'value',size:4,align:4}])
  assert.equal(node.size,longSize===8?16:12)
  assert.equal(node.rows[2].offset,longSize===8?12:8)
}
assert.equal(addressOf('array',2,0,0,8).address,0x1010)
assert.equal(addressOf('array',2,0,0,4).address,0x1008)
assert.equal(addressOf('matrix',0,1,2,8).address,0x1018)
assert.equal(addressOf('record',2,0,0,8).address,0x1038)
assert.equal(stackTrace[0].rsp,stackTrace.at(-1).rsp)
assert.equal(stackTrace[3].rsp%16,0)
assert.equal(stackTrace[4].rsp,stackTrace[3].rsp-8)
assert.equal(stackTrace[5].rsp,stackTrace[3].rsp)
console.log('PASS: integer boundaries, float32 edge cases, both ABI layouts, address calculations and stack restoration')
