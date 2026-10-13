export function interpretBits(value: number, width = 8) {
  const modulus = 2 ** width
  const unsigned = ((Math.trunc(value) % modulus) + modulus) % modulus
  return { unsigned, signed: unsigned >= modulus / 2 ? unsigned - modulus : unsigned,
    binary: unsigned.toString(2).padStart(width, '0') }
}
export function decodeFloat32(text: string) {
  const number = Number(text)
  const data = new DataView(new ArrayBuffer(4))
  data.setFloat32(0, number, false)
  const bits = data.getUint32(0, false)
  const sign = bits >>> 31, exponent = (bits >>> 23) & 255, fraction = bits & 0x7fffff
  const category = exponent === 255 ? (fraction ? 'NaN' : '无穷大') : exponent === 0 ? (fraction ? '非正规数' : '零') : '正规数'
  const result = data.getFloat32(0, false)
  return { bits, sign, exponent, fraction, category, result,
    binary: bits.toString(2).padStart(32, '0'), hex: bits.toString(16).padStart(8, '0'),
    display: Object.is(result, -0) ? '-0' : String(result), power: exponent === 0 ? -126 : exponent - 127 }
}
export type Field = { name: string; size: number; align: number }
export function layoutFields(fields: Field[]) {
  let end = 0
  const alignment = Math.max(1, ...fields.map(field => field.align))
  const rows = fields.map(field => {
    const offset = Math.ceil(end / field.align) * field.align
    const padding = offset - end
    end = offset + field.size
    return { ...field, offset, padding, last: end - 1 }
  })
  const size = Math.ceil(end / alignment) * alignment
  return { rows, size, alignment, tail: size - end }
}
export function addressOf(kind: string, index: number, row: number, col: number, longSize: number) {
  const base = 0x1000
  if (kind === 'matrix') return { address: base + (row * 4 + col) * 4, formula: `4096 + (${row} × 4 + ${col}) × 4`, bytes: 4 }
  if (kind === 'record') return { address: base + index * 24 + 8, formula: `4096 + ${index} × 24 + 8`, bytes: 8 }
  return { address: base + index * longSize, formula: `4096 + ${index} × ${longSize}`, bytes: longSize }
}
export const stackTrace = [
  { instruction: '开始：caller 即将调用 f', rsp: 0x1000, rip: 'caller', note: '调用前栈指针按 16 字节对齐。', slots: [] },
  { instruction: 'call f', rsp: 0x0ff8, rip: 'f', note: '压入回到 caller 的地址；它不是函数返回值。', slots: ['0x0ff8：return → caller'] },
  { instruction: 'pushq %rbp', rsp: 0x0ff0, rip: 'f', note: '保存旧帧指针；接着 movq %rsp, %rbp 建立参考点。', slots: ['0x0ff8：return → caller', '0x0ff0：saved rbp'] },
  { instruction: 'subq $16, %rsp', rsp: 0x0fe0, rip: 'f', note: '预留 16 字节；调用 g 前再次满足 16 字节对齐。', slots: ['0x0ff8：return → caller', '0x0ff0：saved rbp', '0x0fe0–0x0fef：局部空间'] },
  { instruction: 'call g', rsp: 0x0fd8, rip: 'g', note: '嵌套调用增加一层返回地址。本例 g 是不申请局部空间的叶子函数。', slots: ['0x0ff8：return → caller', '0x0ff0：saved rbp', '0x0fe0–0x0fef：局部空间', '0x0fd8：return → f'] },
  { instruction: 'g: ret', rsp: 0x0fe0, rip: 'f 的 call 后', note: '回到 f；g 的计算结果可以留在 rax。', slots: ['0x0ff8：return → caller', '0x0ff0：saved rbp', '0x0fe0–0x0fef：局部空间'] },
  { instruction: 'addq $16, %rsp', rsp: 0x0ff0, rip: 'f', note: '归还局部空间，不意味着这些字节被清零。', slots: ['0x0ff8：return → caller', '0x0ff0：saved rbp'] },
  { instruction: 'popq %rbp', rsp: 0x0ff8, rip: 'f', note: '恢复调用者的帧指针。', slots: ['0x0ff8：return → caller'] },
  { instruction: 'f: ret', rsp: 0x1000, rip: 'caller 的 call 后', note: '栈指针恢复到起始值。', slots: [] }
]
