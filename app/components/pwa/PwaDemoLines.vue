<script setup lang="ts">
// A page's text drawn as grey bars, behind the browser controls in PwaDemoFrame.
defineProps<{ short?: boolean }>()
</script>

<template>
  <div class="absolute flex flex-col gap-2.5">
    <div class="h-3 w-[70%] rounded-full bg-slate-200" />
    <div class="h-3 w-[92%] rounded-full bg-slate-200" />
    <div class="h-3 w-[56%] rounded-full bg-slate-200" />
    <div
      class="rounded-xl bg-slate-100"
      :class="short ? 'h-13' : 'h-16'"
    />
  </div>
</template>
