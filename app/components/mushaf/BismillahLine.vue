<script setup lang="ts">
/**
 * BismillahLine — renders بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
 *
 * Uses the 4 word glyphs from verse 1:1 (Al-Fatihah), rendered through
 * the same QuranWord pipeline so it matches the active font style
 * (QCF glyph fonts or Unicode text fonts).
 */
import type { QuranWord } from '~/types/quran'
import { getWordTextField } from '~/types/quran'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { storeToRefs } from 'pinia'
import { getFontFaceName } from '~/composables/useQcfFont'

interface Props {
  /** The 4 bismillah words from verse 1:1 (positions 1-4 only, no end marker) */
  words: QuranWord[]
  isFontLoaded: boolean
}

defineProps<Props>()
const fontSettings = useFontSettingsStore()
const { quranFont, fontVersion, isQcf } = storeToRefs(fontSettings)
</script>

<template>
  <div class="bismillah-line" dir="rtl">
    <template v-for="word in words" :key="word.position">
      <!-- QCF glyph fonts -->
      <span
        v-if="isQcf"
        class="bismillah-word glyph"
        :class="{ 'glyph-loading': !isFontLoaded }"
        :style="isFontLoaded ? { fontFamily: getFontFaceName(word.page_number, fontVersion) } : {}"
      >{{ getWordTextField(word, quranFont) }}</span>

      <!-- Unicode text fonts -->
      <span
        v-else
        class="bismillah-word text"
        :style="{ fontFamily: quranFont === 'text_indopak' ? 'IndoPakNastaleeq, serif' : 'UthmanicHafs, serif' }"
      >{{ getWordTextField(word, quranFont) }}</span>
    </template>
  </div>
</template>

<style scoped>
.bismillah-line {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  padding: 0.1em 0;
  direction: rtl;
  text-align: center;
  font-size: var(--mushaf-font-size, 5.3vw);
}

.bismillah-word {
  line-height: var(--mushaf-line-height, normal);
  font-size: inherit;
}

.bismillah-word.text {
  line-height: 2;
}

.glyph-loading {
  opacity: 0;
}
</style>
