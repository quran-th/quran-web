<script setup lang="ts">
/**
 * SurahNameLine — renders a decorative surah name glyph using the SurahNameV4 font.
 * Centered on the page, displayed as a single glyph character.
 */
import { getSurahNameGlyph } from '~/composables/useSurahNameGlyph'

interface Props {
  surahId: number
}

const props = defineProps<Props>()

const glyph = computed(() => getSurahNameGlyph(props.surahId))
</script>

<template>
  <div class="surah-name-line" dir="rtl">
    <span class="surah-name-glyph">{{ glyph }}</span>
  </div>
</template>

<style scoped>
.surah-name-line {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.25em 0;
  direction: rtl;
  text-align: center;
}

.surah-name-glyph {
  font-family: 'SurahNameV4', sans-serif;
  font-size: var(--mushaf-font-size, 5.3vw);
  line-height: 1.4;
}
</style>
