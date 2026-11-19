<script setup lang="ts">
defineProps<{
  number: number;
  text: string;
  expanded?: boolean;
}>();

defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="flex w-full gap-1.5 text-left font-reading text-[length:calc(12.5px*var(--book-scale,1))] leading-[1.55] text-ink-muted"
    @click="$emit('toggle')"
  >
    <span class="min-w-[1.25rem] shrink-0 font-semibold tabular-nums text-sage-600">{{ number }}</span>
    <span :class="expanded ? '' : 'line-clamp-2'">{{ text }}</span>
  </button>
</template>
