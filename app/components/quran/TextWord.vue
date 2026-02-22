<script setup lang="ts">
/**
 * TextWord — renders a single word using a Unicode text font.
 *
 * Used for non-QCF font styles:
 *   - QPC Uthmani Hafs → `UthmanicHafs` font
 *   - IndoPak Nastaleeq → `IndoPakNastaleeq` font
 *
 * Unlike GlyphWord, these fonts are globally loaded (no per-page fonts).
 */
import { computed } from 'vue'
import { QuranFont } from '~/types/quran'

interface Props {
  text: string
  quranFont: QuranFont
}

const props = defineProps<Props>()

const fontFamily = computed(() => {
  switch (props.quranFont) {
    case QuranFont.IndoPak:
      return 'IndoPakNastaleeq, serif'
    case QuranFont.QPCHafs:
    default:
      return 'UthmanicHafs, serif'
  }
})
</script>

<template>
  <span class="text-word" :style="{ fontFamily }">{{ text }}</span>
</template>

<style scoped>
.text-word {
  line-height: 2;
  font-size: inherit;
}
</style>
