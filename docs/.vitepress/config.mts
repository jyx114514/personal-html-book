import { defineConfig } from 'vitepress'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const hasPage = (page: string) => existsSync(fileURLToPath(new URL(`../${page}.md`, import.meta.url)))
const hasHome = hasPage('index')
const hasRnaseq = hasPage('chapters/rnaseq')
const hasBackprop = hasPage('chapters/backprop')

export default defineConfig({
  lang:'zh-CN', title:'我的交互式教材', description:'生物信息学与计算机科学学习笔记',
  base: process.env.SITE_BASE || '/', cleanUrls:true,
  markdown:{math:true,lineNumbers:true},
  themeConfig:{
    nav:[...(hasHome ? [{text:'首页',link:'/'}] : []), ...(hasRnaseq ? [{text:'RNA-seq',link:'/chapters/rnaseq'}] : [])],
    sidebar:[...(hasRnaseq ? [{text:'生物信息学',items:[{text:'RNA-seq 分析',link:'/chapters/rnaseq'}]}] : []), ...(hasBackprop ? [{text:'计算机科学',items:[{text:'反向传播',link:'/chapters/backprop'}]}] : [])],
    search:{provider:'local'}, outline:{level:[2,3],label:'本页目录'}
  }
})
