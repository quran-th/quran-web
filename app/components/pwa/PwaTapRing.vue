<script setup lang="ts">
// The gold ring round the button to tap in the drawn phone screens: 48 px round a 36 px button by default.
withDefaults(defineProps<{ inset?: string, round?: string }>(), {
  inset: '-inset-1.5',
  round: 'rounded-2xl',
})
</script>

<template>
  <span
    aria-hidden="true"
    class="pointer-events-none absolute border-2 border-amber-400 motion-safe:animate-tap-ring"
    :class="[inset, round]"
  />
</template>
