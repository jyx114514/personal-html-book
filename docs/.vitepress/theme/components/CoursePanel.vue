<script setup lang="ts">
defineProps<{title:string}>()
</script>
<template><section class="course-panel"><div class="course-panel__title">{{title}}</div><slot /></section></template>
