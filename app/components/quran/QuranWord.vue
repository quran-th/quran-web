<script setup lang="ts">
/**
 * QuranWord — renders a single word with char-type awareness.
 *
 * Switches between GlyphWord (QCF per-page fonts) and TextWord (Unicode text
 * fonts) based on the active font from fontSettingsStore.
 *
 * Font scaling is handled by the parent container (MushafLine applies
 * scale classes from mushaf-scales.css; VerseText can use its own scaling).
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { QuranWord } from '~/types/quran'
import { getWordTextField } from '~/types/quran'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { useRecitationStore } from '~/stores/recitationStore'

interface Props {
  word: QuranWord
  isFontLoaded: boolean
}

const props = defineProps<Props>()

const fontSettings = useFontSettingsStore()
const { quranFont, fontVersion, isQcf } = storeToRefs(fontSettings)

const { activeWordKey } = storeToRefs(useRecitationStore())
const isRecitationActive = computed(
  () => !!props.word.verse_key && activeWordKey.value === `${props.word.verse_key}:${props.word.position}`,
)
</script>

<template>
  <div
    v-if="word.char_type_name !== 'pause'"
    class="quran-word rounded-md transition-colors duration-150"
    :class="{ 'bg-amber-100 text-amber-900': isRecitationActive }"
  >
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
