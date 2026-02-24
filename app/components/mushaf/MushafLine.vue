<script setup lang="ts">
/**
 * MushafLine — renders one line of a Mushaf page.
 * Words are justified across the full width in RTL layout,
 * except for special pages (1-2) where they are centered.
 *
 * Font size, line height, and container width are driven by CSS variables
 * set on the parent MushafPageView via mushaf-scales.css classes.
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
  font-size: var(--mushaf-font-size, 5.3vw);
  line-height: var(--mushaf-line-height, normal);
}

.mushaf-line--centered {
  justify-content: center;
}
</style>
