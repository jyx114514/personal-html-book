import { defineConfig } from 'vitepress'
export default defineConfig({
  lang:'zh-CN', title:'我的交互式教材', description:'生物信息学与计算机科学学习笔记',
  base: process.env.SITE_BASE || '/', cleanUrls:true,
  markdown:{math:true,lineNumbers:true},
  themeConfig:{
    nav:[{text:'首页',link:'/'},{text:'RNA-seq',link:'/chapters/rnaseq'}],
    sidebar:[{text:'生物信息学',items:[{text:'RNA-seq 分析',link:'/chapters/rnaseq'}]},{text:'计算机科学',items:[{text:'反向传播',link:'/chapters/backprop'}]}],
    search:{provider:'local'}, outline:{level:[2,3],label:'本页目录'}
  }
})
