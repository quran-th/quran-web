<script setup lang="ts">
/**
 * MushafLine — renders one line of a Mushaf page.
 * Words are justified across the full width in RTL layout,
 * except for special pages (1-2) where they are centered.
 */
import type { QuranWord } from '~/types/quran'

interface Props {
  words: QuranWord[]
  isFontLoaded: (pageNumber: number) => boolean
  centered?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="mushaf-line" :class="{ 'mushaf-line--centered': centered }" dir="rtl">
    <QuranWord
      v-for="word in words"
      :key="`${word.page_number}-${word.line_number}-${word.position}`"
      :word="word"
      :is-font-loaded="isFontLoaded(word.page_number)"
    />
  </div>
</template>

<style scoped>
.mushaf-line {
  display: flex;
  justify-content: space-between;
  direction: rtl;
  text-align: right;
  /* Mobile: vw-based scaling */
  font-size: 5.3vw;
  line-height: 10.1vw;
  min-height: 10.1vw;
}

/* Tablet+ : cqh-based scaling (fits container height) */
@media (min-width: 768px) {
  .mushaf-line {
    font-size: 3.2cqh;
    line-height: 6.1cqh;
    min-height: 6.1cqh;
  }
}

.mushaf-line--centered {
  justify-content: center;
  gap: 0.5em;
}
</style>
