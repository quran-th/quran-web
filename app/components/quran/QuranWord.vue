<script setup lang="ts">
/**
 * QuranWord — renders a single word with char-type awareness.
 *
 * Switches between GlyphWord (QCF per-page fonts) and TextWord (Unicode text
 * fonts) based on the active font from fontSettingsStore.
 *
 * Also applies font scale as a CSS transform to uniformly scale all word types.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { QuranWord } from '~/types/quran'
import { getWordTextField } from '~/types/quran'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'

interface Props {
  word: QuranWord
  isFontLoaded: boolean
}

defineProps<Props>()

const fontSettings = useFontSettingsStore()
const { quranFont, fontVersion, isQcf, fontScale } = storeToRefs(fontSettings)

/**
 * Maps fontScale 1-5 to a multiplier: 1→0.7, 2→0.85, 3→1.0, 4→1.15, 5→1.3
 * Default store value is 3 = 1.0x (no change).
 */
const scaleStyle = computed(() => {
  const multiplier = 0.7 + (fontScale.value - 1) * 0.15
  return { fontSize: `${multiplier}em` }
})
</script>

<template>
  <div v-if="word.char_type_name !== 'pause'" class="quran-word" :style="scaleStyle">
    <!-- QCF glyph fonts: V1, V2, Tajweed V4 -->
    <QuranGlyphWord
      v-if="isQcf"
      :glyph-code="getWordTextField(word, quranFont)"
      :page-number="word.page_number"
      :font-version="fontVersion"
      :is-font-loaded="isFontLoaded"
    />

    <!-- Unicode text fonts: QPC Uthmani Hafs, IndoPak Nastaleeq -->
    <QuranTextWord v-else :text="getWordTextField(word, quranFont)" :quran-font="quranFont" />
  </div>
</template>

<style scoped>
.quran-word {
  display: inline-block;
  cursor: default;
}
</style>
