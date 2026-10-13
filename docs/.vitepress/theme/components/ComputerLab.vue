<script setup lang="ts">
import { computed, ref } from 'vue'
import { interpretBits, decodeFloat32, layoutFields, addressOf, stackTrace } from './computerModels'
const props = defineProps<{ mode: 'bits' | 'float' | 'address' | 'layout' | 'stack' }>()
const titles = { bits: '同一组位，两种整数解释', float: '拆开一个 IEEE 754 binary32', address: '把下标翻译成字节地址', layout: '字段顺序、ABI 与 padding', stack: '单步观察嵌套调用的栈' }
const value = ref(255), addend = ref(1), floatText = ref('0.1')
const kind = ref('array'), abi = ref('lp64'), index = ref(2), row = ref(1), col = ref(2)
const preset = ref('Record'), step = ref(0)
const bits = computed(() => interpretBits(value.value))
const sum = computed(() => interpretBits(value.value + addend.value))
const fp = computed(() => decodeFloat32(floatText.value))
const floatValid = computed(() => floatText.value.trim() !== '' && (!Number.isNaN(Number(floatText.value)) || floatText.value.trim().toLowerCase() === 'nan'))
const longSize = computed(() => abi.value === 'lp64' ? 8 : 4)
const address = computed(() => addressOf(kind.value, index.value, row.value, col.value, longSize.value))
const layout = computed(() => {
  const char = { name: 'char tag', size: 1, align: 1 }, int = { name: 'int id', size: 4, align: 4 }, double = { name: 'double score', size: 8, align: 8 }
  const fields = preset.value === 'Node' ? [{ name: 'long id', size: longSize.value, align: longSize.value }, { ...char, name: 'char flag' }, { ...int, name: 'int value' }]
    : preset.value === 'Record' ? [int, double, char] : [double, int, char]
  return layoutFields(fields)
})
const state = computed(() => stackTrace[step.value])
const hex = (n: number) => '0x' + n.toString(16).padStart(4, '0')
function reset() { value.value=255; addend.value=1; floatText.value='0.1'; kind.value='array'; abi.value='lp64'; index.value=2; row.value=1; col.value=2; preset.value='Record'; step.value=0 }
</script>
<template>
  <section class="computer-lab course-panel" :data-lab="props.mode" :aria-label="titles[props.mode]">
    <h3>{{ titles[props.mode] }}</h3>
    <p class="course-note">教学模型：这里计算指定规则下的结果，不读取本机内存，也不执行 C 或汇编。</p>
    <template v-if="props.mode === 'bits'">
      <label>8 位原始值：{{ value }}<input v-model.number="value" aria-label="8 位原始值" type="range" min="0" max="255" /></label>
      <div class="bit-row" role="group" aria-label="从最高位到最低位，点击切换每一位">
        <button v-for="(bit,i) in bits.binary" :key="i" :aria-label="`切换第 ${7-i} 位，当前 ${bit}`" :aria-pressed="bit === '1'" @click="value = value ^ (1 << (7-i))">{{ bit }}</button>
      </div>
      <p aria-live="polite">无符号解释：<strong>{{ bits.unsigned }}</strong>；补码解释：<strong>{{ bits.signed }}</strong>。</p>
      <label>另一个无符号加数：{{ addend }}<input v-model.number="addend" aria-label="无符号加数" type="range" min="0" max="255" /></label>
      <p aria-live="polite">数学和 {{ value + addend }} → 保留低 8 位 {{ sum.binary }} → 无符号结果 {{ sum.unsigned }}；{{ value + addend > 255 ? '有进位溢出' : '没有进位溢出' }}。</p>
      <p>8 位是人工限定的演示宽度。C 的小整数会先做整数提升，不能把此模型当作 uint8_t 表达式的中间运算。</p>
    </template>
    <template v-else-if="props.mode === 'float'">
      <label>输入数值（支持 -0、NaN、Infinity）<input v-model="floatText" aria-label="浮点输入" type="text" spellcheck="false" /></label>
      <div class="controls"><button v-for="example in ['0.1','-0','1.401298464324817e-45','16777217','Infinity','NaN']" :key="example" @click="floatText=example">{{ example }}</button></div>
      <p v-if="!floatValid" role="alert">请输入有效数值，或 NaN / Infinity。</p>
      <div v-else aria-live="polite">
        <p><code>{{ fp.binary.slice(0,1) }} | {{ fp.binary.slice(1,9) }} | {{ fp.binary.slice(9) }}</code></p>
        <p>符号 {{ fp.sign }} · 指数字段 {{ fp.exponent }} · 小数字段 {{ fp.fraction }} · 十六进制 <code>0x{{ fp.hex }}</code></p>
        <p><strong>{{ fp.category }}</strong>，存入 binary32 后的值：{{ fp.display }}。</p>
        <p v-if="fp.category === '正规数'">解释：(-1)^{{ fp.sign }} × (1 + {{ fp.fraction }}/2²³) × 2^{{ fp.power }}。</p>
        <p v-else-if="fp.category === '非正规数'">解释：(-1)^{{ fp.sign }} × ({{ fp.fraction }}/2²³) × 2⁻¹²⁶；这里没有隐含的 1。</p>
        <p v-else>特殊字段组合不能套正规数公式。NaN 的具体 payload 可随实现变化。</p>
      </div>
      <p>浏览器先将输入解析为 binary64，再用 DataView 舍入到 binary32；不是任意精度十进制直接转换器。</p>
    </template>
    <template v-else-if="props.mode === 'address'">
      <label>对象<select v-model="kind" aria-label="地址对象"><option value="array">long a[4]</option><option value="matrix">int m[3][4]</option><option value="record">Record a[4] 的 score</option></select></label>
      <label v-if="kind==='array'">数据模型<select v-model="abi" aria-label="数组数据模型"><option value="lp64">Linux x86-64 LP64：long 8 字节</option><option value="llp64">Windows x64 LLP64：long 4 字节</option></select></label>
      <template v-if="kind==='matrix'">
        <label>行 i：{{ row }}<input v-model.number="row" aria-label="矩阵行" type="range" min="0" max="2" /></label>
        <label>列 j：{{ col }}<input v-model.number="col" aria-label="矩阵列" type="range" min="0" max="3" /></label>
      </template>
      <label v-else>下标 i：{{ index }}<input v-model.number="index" aria-label="数组下标" type="range" min="0" max="3" /></label>
      <p aria-live="polite">基地址 0x1000；{{ address.formula }} = <strong>{{ hex(address.address) }}</strong>。若读取该对象，访问 {{ address.bytes }} 字节：{{ hex(address.address) }}–{{ hex(address.address+address.bytes-1) }}。</p>
      <p>Record 按自然对齐布局，步长 24、score 偏移 8。公式中的 4096 是字节地址整数；C 的 a+i 已自动按元素大小缩放。</p>
    </template>
    <template v-else-if="props.mode === 'layout'">
      <label>字段顺序<select v-model="preset" aria-label="结构体字段顺序"><option value="Record">Record：int, double, char</option><option value="Reordered">重排：double, int, char</option><option value="Node">Node：long, char, int</option></select></label>
      <label>自然对齐数据模型<select v-model="abi" aria-label="结构体数据模型"><option value="lp64">Linux x86-64 LP64</option><option value="llp64">Windows x64 LLP64</option></select></label>
      <div class="course-table-scroll" tabindex="0" role="region" aria-label="结构体字段布局"><table><thead><tr><th>字段</th><th>大小</th><th>对齐</th><th>前置 padding</th><th>字节区间</th></tr></thead><tbody><tr v-for="field in layout.rows" :key="field.name"><td>{{ field.name }}</td><td>{{ field.size }}</td><td>{{ field.align }}</td><td>{{ field.padding }}</td><td>{{ field.offset }}–{{ field.last }}</td></tr></tbody></table></div>
      <p aria-live="polite">结构体对齐 {{ layout.alignment }} 字节；尾部 padding {{ layout.tail }} 字节；<strong>sizeof = {{ layout.size }}</strong>。</p>
      <p>模型限定普通字段、自然对齐、无 packing 或显式对齐设置。实际布局以目标 ABI 与 sizeof / offsetof 为准。</p>
    </template>
    <template v-else>
      <p aria-live="polite">步骤 {{ step }}/{{ stackTrace.length-1 }}：<strong>{{ state.instruction }}</strong>；rsp = {{ hex(state.rsp) }}；控制流 = {{ state.rip }}。</p>
      <p>{{ state.note }}</p>
      <ol aria-label="高地址到低地址的有效栈内容"><li v-for="slot in state.slots" :key="slot"><code>{{ slot }}</code></li></ol>
      <p v-if="!state.slots.length">本例尚无额外有效栈槽；调用者已有栈内容省略。</p>
      <div class="controls"><button :disabled="step===0" @click="step--">上一步</button><button :disabled="step===stackTrace.length-1" @click="step++">下一步</button></div>
      <p>本模型采用 System V AMD64 的普通近调用；不模拟优化、red zone、异常展开与尾调用。</p>
    </template>
    <button @click="reset">恢复初始值</button>
  </section>
</template>
<style scoped>
.computer-lab h3 { margin-top: 0; }
.computer-lab label { display: block; margin: 1rem 0; }
.computer-lab input[type="range"] { display: block; width: 100%; accent-color: var(--vp-c-brand-1); }
.computer-lab input[type="text"], .computer-lab select { display: block; width: 100%; padding: .5rem; border: 1px solid var(--vp-c-divider); border-radius: var(--course-radius); background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.computer-lab button { padding: .4rem .7rem; border: 1px solid var(--vp-c-divider); border-radius: var(--course-radius); background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; }
.computer-lab button[aria-pressed="true"] { background: var(--vp-c-brand-soft); border-color: var(--vp-c-brand-1); }
.computer-lab button:disabled { opacity: .45; cursor: default; }
.computer-lab :is(button,input,select):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.bit-row, .controls { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
.computer-lab code { overflow-wrap: anywhere; white-space: normal; }
</style>
