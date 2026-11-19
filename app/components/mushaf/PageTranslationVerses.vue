<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRecitationStore } from '~/stores/recitationStore'
import type { Verse } from '~/stores/quranStore'
import { splitFootnoteMarkers } from '~/composables/usePageTranslations'

interface Props {
  verses: Verse[]
  size: 'column' | 'sheet'
  highlightKey?: string
}

defineProps<Props>()

const { activeVerseKey, status } = storeToRefs(useRecitationStore())
</script>

<template>
  <p
    v-for="verse in verses"
    :key="`${verse.surahNumber}:${verse.verseNumber}`"
    :data-verse-key="`${verse.surahNumber}:${verse.verseNumber}`"
    class="-mx-2 mb-1.5 rounded-lg px-2 py-1 font-reading text-ink-soft transition-colors"
    :class="[
      size === 'sheet' ? 'text-[15px] leading-[1.7]' : 'text-[14.5px] leading-[1.65] @min-[340px]:text-base @min-[340px]:leading-[1.75]',
      highlightKey === `${verse.surahNumber}:${verse.verseNumber}` ? 'bg-paper-wash' : '',
    ]"
  >
    <span
      class="mr-1.5 font-semibold tabular-nums"
      :class="status === 'playing' && activeVerseKey === `${verse.surahNumber}:${verse.verseNumber}`
        ? 'ayah-glow [--ayah-disc-h:1.5em] [--ayah-disc-w:calc(100%+0.75em)]'
        : 'text-sage-600'"
    >{{ verse.verseNumber }}</span>
    <template v-for="(part, i) in splitFootnoteMarkers(verse.translation || '')" :key="i">
      <sup v-if="part.type === 'footnote'" class="mx-px text-[0.7em] font-semibold text-sage-600">{{ part.value }}</sup>
      <template v-else>{{ part.value }}</template>
    </template>
  </p>
</template>
