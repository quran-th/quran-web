<script setup lang="ts">
/**
 * VerseText — renders all words of a verse in RTL layout using QCF V2 glyphs.
 */
import type { QuranWord } from '~/types/quran'

interface Props {
  words: QuranWord[]
  isFontLoaded: (pageNumber: number) => boolean
}

defineProps<Props>()
</script>

<template>
  <div class="verse-text" dir="rtl">
    <QuranWord
      v-for="word in words"
      :key="`${word.page_number}-${word.position}`"
      :word="word"
      :is-font-loaded="isFontLoaded(word.page_number)"
    />
  </div>
</template>

<style scoped>
.verse-text {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  direction: rtl;
  text-align: right;
  font-size: 1.8rem;
  line-height: 2.5;
  gap: 0;
}
</style>
