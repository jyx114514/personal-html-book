<script setup lang="ts">
import { computed, ref } from 'vue'
const x = ref(2)
const w = ref(3)
const y = computed(() => w.value * x.value ** 2)
const dx = computed(() => 2 * w.value * x.value)
const dw = computed(() => x.value ** 2)
</script>

<template>
  <section class="demo" aria-label="反向传播交互演示">
    <h3>调整参数，观察梯度变化</h3>
    <div class="graph" role="img" :aria-label="`输入 ${x}，平方 ${x*x}，输出 ${y}`">
      <span>x = {{ x }}</span><b>→</b><span>x² = {{ x*x }}</span><b>→</b><span>y = {{ y }}</span>
    </div>
    <label>输入 x：{{ x }}<input v-model.number="x" type="range" min="-5" max="5" step="0.5" /></label>
    <label>权重 w：{{ w }}<input v-model.number="w" type="range" min="-5" max="5" step="0.5" /></label>
    <div class="results"><div>∂y/∂x = <strong>{{ dx }}</strong></div><div>∂y/∂w = <strong>{{ dw }}</strong></div></div>
    <p>链式法则：∂y/∂x = w · 2x；∂y/∂w = x²。</p>
    <button @click="x=2; w=3">恢复初始值</button>
  </section>
</template>

<style scoped>
.demo{border:1px solid var(--vp-c-divider);border-radius:16px;padding:22px;margin:24px 0;background:var(--vp-c-bg-soft)}
.demo h3{margin:0 0 16px}.graph{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.graph span{background:var(--vp-c-brand-soft);border:1px solid var(--vp-c-brand-1);border-radius:10px;padding:12px;flex:1;text-align:center;min-width:75px}
.demo label{display:block;margin:16px 0}.demo input{display:block;width:100%;accent-color:var(--vp-c-brand-1)}
.results{display:grid;grid-template-columns:1fr 1fr;gap:12px}.results div{padding:12px;background:var(--vp-c-bg);border-radius:10px}
.demo button{border:1px solid var(--vp-c-divider);padding:7px 14px;border-radius:8px;cursor:pointer}
@media(max-width:480px){.results{grid-template-columns:1fr}}
</style>
