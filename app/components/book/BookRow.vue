<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useRecitationStore } from "~/stores/recitationStore";
import type { BookVerse } from "~/composables/useBookVerses";

const props = withDefaults(defineProps<{
  verse: BookVerse;
  footnoteStart?: number;
}>(), { footnoteStart: 1 });

// Ayah mark (۝ + digits) is tinted apart from the text
const arabicBody = computed(() => props.verse.arabic.slice(0, props.verse.arabic.lastIndexOf("۝")));
const arabicMark = computed(() => props.verse.arabic.slice(props.verse.arabic.lastIndexOf("۝")));

const { activeVerseKey, status } = storeToRefs(useRecitationStore());
const isGlowing = computed(() => status.value === "playing" && activeVerseKey.value === props.verse.key);

// Footnote numbers restart on every page, so the verse's own numbers map to the page-local sequence
function localNumber(footnoteNumber: number | undefined): number | null {
  const index = props.verse.footnotes.findIndex(f => f.number === footnoteNumber);
  return index === -1 ? null : props.footnoteStart + index;
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-7 py-2">
    <p class="m-0 flex gap-2 font-reading text-[14.5px] leading-[1.7] text-ink-soft">
      <span class="min-w-[18px] shrink-0 font-semibold tabular-nums text-sage-600">{{ verse.verseNumber }}.</span>
      <span>
        <template v-for="(segment, i) in verse.thaiSegments" :key="i">
          <template v-if="segment.type === 'text'">{{ segment.content }}</template>
          <sup
            v-else-if="localNumber(segment.footnoteNumber) !== null"
            class="ml-px text-[10px] font-semibold text-sage-600"
          >{{ localNumber(segment.footnoteNumber) }}</sup>
        </template>
      </span>
    </p>
    <p dir="rtl" lang="ar" class="m-0 text-right font-arabic text-[20px] leading-[2] text-ink-strong">{{ arabicBody }}<span class="text-sage-600" :class="{ 'ayah-glow': isGlowing }">{{ arabicMark }}</span></p>
  </div>
</template>
