<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ mode: 'signal' | 'tpm' | 'methyl' | 'hic' | 'mass' | 'flux' }>()
const titles = { signal: '同一段基因组，不同的测量对象', tpm: 'Counts 与 TPM：长度和组成的影响', methyl: '甲基化比例与覆盖度', hic: '识别接触矩阵中的图案', mass: '电荷态如何改变 m/z', flux: '同一个代谢池，不同的周转速度' }
const assay = ref('rna')
const shortCount = ref(100), longCount = ref(200), thirdCount = ref(0)
const retained = ref(7), converted = ref(3)
const pattern = ref('distance')
const mass = ref(1000), charge = ref(2)
const flux = ref(1), time = ref(5)
const signals: Record<string, { label: string; values: number[]; text: string }> = {
  rna: { label: 'RNA-seq', values: [5,8,12,10,3,1,1,2,8,12,11,7,2,1,0,2,9,13,10,4,1,0,0,1], text: '常规成熟 mRNA 文库在外显子及剪接连接处贡献信号；这里的三个富集区只作示意。' },
  atac: { label: 'ATAC-seq', values: [1,1,2,3,10,15,8,3,1,1,2,2,3,9,16,11,3,1,1,2,2,1,1,0], text: 'Tn5 更容易接近的区域形成局部片段富集。开放区域不等于某个转录因子已经结合。' },
  chip: { label: 'TF ChIP-seq', values: [0,1,1,1,2,3,2,1,1,1,2,4,11,18,10,4,2,1,1,1,0,1,0,1], text: '特定抗体富集的 DNA 形成定位信号。富集说明与靶蛋白关联，仍需要对照和功能验证。' },
  broad: { label: '宽域组蛋白信号', values: [1,1,2,3,4,7,9,11,13,14,15,14,15,14,13,12,10,8,5,3,2,1,1,1], text: '某些修饰可形成广泛富集域。应依据靶标选择分析策略，不能统一套用窄峰模型。' }
}
const selectedSignal = computed(() => signals[assay.value])
const tpm = computed(() => {
  const rates = [shortCount.value, longCount.value / 2, thirdCount.value]
  const total = rates.reduce((a, b) => a + b, 0)
  return rates.map(r => total ? r / total * 1e6 : 0)
})
const coverage = computed(() => retained.value + converted.value)
const beta = computed(() => coverage.value ? retained.value / coverage.value : null)
const interval = computed(() => {
  if (beta.value === null) return null
  const p = beta.value, n = coverage.value, z = 1.959963984540054
  const denominator = 1 + z * z / n
  const centre = (p + z * z / (2 * n)) / denominator
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
})
const matrix = computed(() => Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => {
  let v = 0.2 + 3.7 / (1 + Math.abs(i - j) * 0.72)
  if (pattern.value === 'domains' && Math.floor(i / 4) === Math.floor(j / 4)) v += 2
  if (pattern.value === 'loop' && ((i === 2 && j === 9) || (i === 9 && j === 2))) v += 5
  if (pattern.value === 'compartments' && Math.floor(i / 3) % 2 === Math.floor(j / 3) % 2) v += 1.8
  return v
})))
const descriptions: Record<string, string> = {
  distance: '靠近主对角线的接触较强：模拟基因组距离衰减。',
  domains: '沿对角线出现三个局部富集方块：模拟接触结构域。',
  loop: '出现两个关于主对角线对称的局部亮点：模拟特定位点间的接触富集。',
  compartments: '较远位置仍出现交替的棋盘图案：模拟同类区室间的偏好接触。'
}
const mz = computed(() => (mass.value + charge.value * 1.007276466621) / charge.value)
const labelled = computed(() => 1 - Math.exp(-flux.value * time.value / 10))
const curve = computed(() => Array.from({ length: 61 }, (_, i) => `${45 + i * 7.5},${155 - (1 - Math.exp(-flux.value * i / 30)) * 120}`).join(' '))
function reset() {
  assay.value = 'rna'; shortCount.value = 100; longCount.value = 200; thirdCount.value = 0
  retained.value = 7; converted.value = 3; pattern.value = 'distance'
  mass.value = 1000; charge.value = 2; flux.value = 1; time.value = 5
}
const number = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
const percent = (n: number) => (n * 100).toFixed(1) + '%'
</script>

<template>
  <section class="omics-lab course-panel" :data-lab="props.mode" :aria-label="titles[props.mode]">
    <h3>{{ titles[props.mode] }}</h3>
    <p class="lab-caption">教学模拟 · 滑块支持键盘方向键 · 图形下方提供文字与数值对照</p>
    <template v-if="mode === 'signal'">
      <label>测量技术<select v-model="assay" aria-label="测量技术"><option v-for="(item, key) in signals" :key="key" :value="key">{{ item.label }}</option></select></label>
      <svg viewBox="0 0 540 190" role="img" :aria-label="selectedSignal.label + '模拟信号；横轴为基因组位置，纵轴为任意单位'">
        <line class="axis" x1="30" y1="150" x2="520" y2="150" />
        <rect v-for="(v,i) in selectedSignal.values" :key="i" class="signal" :x="38+i*20" :y="150-v*6" width="15" :height="v*6" />
        <text x="30" y="20">信号（任意单位）</text><text x="190" y="180">基因组位置 →</text>
      </svg>
      <div class="lab-result" aria-live="polite"><strong>{{ selectedSignal.label }}</strong><p>{{ selectedSignal.text }}</p></div>
      <details><summary>展开模拟数值</summary><p>{{ selectedSignal.values.join('，') }}</p></details>
      <p>图形为人为设计，跨技术柱高不能比较；不是 peak calling 或显著性检验。</p>
    </template>
    <template v-else-if="mode === 'tpm'">
      <label>A 计数（长度 1 kb）：{{ shortCount }}<input v-model.number="shortCount" aria-label="A 计数" type="range" min="0" max="1000" step="10" /></label>
      <label>B 计数（长度 2 kb）：{{ longCount }}<input v-model.number="longCount" aria-label="B 计数" type="range" min="0" max="1000" step="10" /></label>
      <label>C 计数（长度 1 kb）：{{ thirdCount }}<input v-model.number="thirdCount" aria-label="C 计数" type="range" min="0" max="2000" step="50" /></label>
      <div class="lab-result" aria-live="polite"><p v-if="shortCount + longCount + thirdCount === 0">总计数为 0，TPM 未定义。</p><p v-else>A：{{ number(tpm[0]) }} TPM；B：{{ number(tpm[1]) }} TPM；C：{{ number(tpm[2]) }} TPM。</p><p>长度校正值：{{ shortCount }}、{{ longCount / 2 }}、{{ thirdCount }}。固定 A、B，再增加 C，会降低 A、B 的 TPM。</p></div>
      <p>假设只有这三个转录本，且固定有效长度。现实转录本定量使用协议和软件对应的有效长度模型。</p>
    </template>
    <template v-else-if="mode === 'methyl'">
      <label>读为 C 的独立分子：{{ retained }}<input v-model.number="retained" aria-label="读为 C 的分子数" type="range" min="0" max="100" /></label>
      <label>读为 T 的独立分子：{{ converted }}<input v-model.number="converted" aria-label="读为 T 的分子数" type="range" min="0" max="100" /></label>
      <div class="lab-result" aria-live="polite"><p>覆盖度：{{ coverage }}；保留 C 的比例：{{ beta === null ? '未定义' : percent(beta) }}。</p><p v-if="interval">95% Wilson 区间：{{ percent(interval[0]) }}–{{ percent(interval[1]) }}。</p><p v-else>没有覆盖，不能报告为 0% 甲基化。</p></div>
      <p>区间仅描述理想独立二项抽样误差。它不包含转换失败、5hmC 混合、重复分子、样本异质性及生物学重复间的变异。</p>
    </template>
    <template v-else-if="mode === 'hic'">
      <label>模拟接触图案<select v-model="pattern" aria-label="模拟接触图案"><option value="distance">距离衰减</option><option value="domains">局部结构域</option><option value="loop">接触环亮点</option><option value="compartments">区室棋盘</option></select></label>
      <svg class="contact-map" viewBox="0 0 360 350" role="img" :aria-label="descriptions[pattern]">
        <g v-for="(row,i) in matrix" :key="i"><rect v-for="(v,j) in row" :key="j" class="signal" :x="50+j*23" :y="20+i*23" width="22" height="22" :fill-opacity="Math.min(1, v/6)" /></g>
        <text x="95" y="325">基因组位置（列） →</text><text x="6" y="15">行 ↓</text>
      </svg>
      <div class="lab-result" aria-live="polite">{{ descriptions[pattern] }}</div>
      <details><summary>展开 12 × 12 接触矩阵数值</summary><div class="matrix-values"><table><caption>模拟接触强度（任意单位）</caption><tbody><tr v-for="(row,i) in matrix" :key="i"><td v-for="(v,j) in row" :key="j">{{ v.toFixed(1) }}</td></tr></tbody></table></div></details>
      <p>为突出单个概念，这里分别加入距离、结构域、环或区室图案。真实数据包含多种结构及技术偏差；本组件不执行 ICE、O/E、PC1 或 loop calling。</p>
    </template>
    <template v-else-if="mode === 'mass'">
      <label>肽段中性单同位素质量（Da）：{{ mass }}<input v-model.number="mass" aria-label="肽段中性质量" type="range" min="500" max="3000" step="50" /></label>
      <label>正电荷数 z：{{ charge }}<input v-model.number="charge" aria-label="正电荷数" type="range" min="1" max="5" /></label>
      <div class="lab-result" aria-live="polite">m/z = {{ mz.toFixed(4) }}；同一肽段改变电荷态，质量没有改变，m/z 会改变。</div>
      <p>假设仅由 z 个质子加合形成正离子，不模拟钠加合、同位素包络、碎裂或强度。</p>
    </template>
    <template v-else>
      <label>稳态流入 = 流出（池单位 / 分钟）：{{ flux }}<input v-model.number="flux" aria-label="稳态通量" type="range" min="0.5" max="10" step="0.5" /></label>
      <label>示踪时间（分钟）：{{ time }}<input v-model.number="time" aria-label="示踪时间" type="range" min="0" max="20" /></label>
      <svg viewBox="0 0 540 190" role="img" :aria-label="`固定池大小 10；通量 ${flux}；${time} 分钟时标记比例 ${percent(labelled)}`">
        <line class="axis" x1="45" y1="155" x2="500" y2="155" /><line class="axis" x1="45" y1="30" x2="45" y2="155" />
        <polyline class="curve" :points="curve" /><circle class="signal" :cx="45+time*22.5" :cy="155-labelled*120" r="5" />
        <text x="5" y="28">100%</text><text x="15" y="156">0%</text><text x="45" y="178">0 min</text><text x="465" y="178">20 min</text>
      </svg>
      <div class="lab-result" aria-live="polite"><p>池大小固定为 10；净积累速度为 0；周转时间 = {{ (10/flux).toFixed(1) }} 分钟；{{ time }} 分钟时标记比例 = {{ percent(labelled) }}。</p></div>
      <p>单一、充分混合且恒定的池；标记输入瞬时达到 100%，不可逆流出且无旁路。此教学模型不等于完整的 ¹³C-MFA。</p>
    </template>
    <button type="button" @click="reset">恢复初始值</button>
  </section>
</template>

<style scoped>
.omics-lab h3{margin:0 0 8px}.lab-caption{color:var(--vp-c-text-2);font-size:.875rem}.omics-lab label{display:block;margin:16px 0;font-weight:500}.omics-lab input{display:block;width:100%;accent-color:var(--vp-c-brand-1);margin-top:10px}.omics-lab select{display:block;width:100%;background:var(--vp-c-bg);border:1px solid var(--vp-c-divider);border-radius:var(--course-radius);padding:10px;margin-top:8px;color:var(--vp-c-text-1);font:inherit}.omics-lab svg{display:block;width:100%;height:auto;margin:16px 0}.omics-lab .contact-map{max-width:420px;margin:20px auto}.omics-lab svg text{fill:var(--vp-c-text-2);font-size:12px}.axis{stroke:var(--vp-c-divider);stroke-width:2}.signal{fill:var(--vp-c-brand-1)}.curve{fill:none;stroke:var(--vp-c-brand-1);stroke-width:3}.lab-result{background:var(--vp-c-bg);border:1px solid var(--vp-c-divider);border-radius:var(--course-radius);padding:14px;overflow-wrap:anywhere}.omics-lab button{border:1px solid var(--vp-c-divider);border-radius:var(--course-radius);background:var(--vp-c-bg);padding:8px 16px;margin-top:12px;cursor:pointer;font:inherit}.omics-lab summary{cursor:pointer;font-weight:500;padding:10px 0}.omics-lab :is(input,select,button,summary):focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:4px}.matrix-values{overflow-x:auto}.matrix-values table{font-size:.8rem;white-space:nowrap}.matrix-values td{padding:4px 8px}.omics-lab p{overflow-wrap:anywhere}
</style>
