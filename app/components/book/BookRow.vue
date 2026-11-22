<script setup lang="ts">
import { computed, inject } from "vue";
import { storeToRefs } from "pinia";
import { useRecitationStore } from "~/stores/recitationStore";
import { useQuranFont } from "~/composables/useQuranFont";
import { BOOK_FONT_LOADED_KEY, type BookVerse } from "~/composables/useBookVerses";
import { QuranFont } from "~/types/quran";

const props = withDefaults(defineProps<{
  verse: BookVerse;
  footnoteStart?: number;
  /** Sizes the number column for the surah's longest verse number, so every row shares one indent */
  versesCount?: number;
}>(), { footnoteStart: 1, versesCount: 0 });

const numberWidth = computed(() => `${String(props.versesCount || props.verse.verseNumber).length + 0.5}ch`);

// The trailing digits render as the ayah ornament, tinted apart from the text
const markStart = computed(() => props.verse.arabic.lastIndexOf(" ") + 1);
const arabicBody = computed(() => props.verse.arabic.slice(0, markStart.value));
const arabicMark = computed(() => props.verse.arabic.slice(markStart.value));

const { quranFont, isQcf } = useQuranFont();

// Each font draws words at a different size for the same px (median ink width over
// 386 words of Al-Baqarah, against QPC Hafs): V1 0.95, V2 1.09, Tajweed 1.12, IndoPak 0.98.
// Dividing by those evens it out, so every font reads like QPC at 22px beside 16px Thai.
const QPC_PX = 22;
const ARABIC_PX: Record<QuranFont, number> = {
  [QuranFont.QPCHafs]: QPC_PX,
  [QuranFont.MadaniV1]: QPC_PX / 0.95,
  [QuranFont.MadaniV2]: QPC_PX / 1.09,
  [QuranFont.TajweedV4]: QPC_PX / 1.12,
  [QuranFont.IndoPak]: QPC_PX / 0.98,
};
const arabicSize = computed(() => `calc(${ARABIC_PX[quranFont.value]}px * var(--book-scale, 1))`);
const fallbackSize = `calc(${ARABIC_PX[QuranFont.QPCHafs]}px * var(--book-scale, 1))`;
const isFontLoaded = inject(BOOK_FONT_LOADED_KEY, () => false);
// Plain text stands in until every page font the verse spans has loaded, or for good if one fails
const wordsReady = computed(() =>
  props.verse.words.length > 0 && (!isQcf.value || props.verse.words.every(w => isFontLoaded(w.page_number))),
);

const { activeVerseKey, status } = storeToRefs(useRecitationStore());
const isGlowing = computed(() => status.value === "playing" && activeVerseKey.value === props.verse.key);

// Footnote numbers restart on every page, so the verse's own numbers map to the page-local sequence
function localNumber(footnoteNumber: number | undefined): number | null {
  const index = props.verse.footnotes.findIndex(f => f.number === footnoteNumber);
  return index === -1 ? null : props.footnoteStart + index;
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-baseline gap-x-7 py-2">
    <p class="m-0 flex gap-2 font-reading text-[length:calc(16px*var(--book-scale,1))] leading-[1.7] text-ink-soft">
      <span class="shrink-0 font-semibold tabular-nums text-sage-600" :style="{ minWidth: numberWidth }">{{ verse.verseNumber }}.</span>
      <span>
        <template v-for="(segment, i) in verse.thaiSegments" :key="i">
          <template v-if="segment.type === 'text'">{{ segment.content }}</template>
          <sup
            v-else-if="localNumber(segment.footnoteNumber) !== null"
            class="ml-px text-[0.68em] font-semibold text-sage-600"
          >{{ localNumber(segment.footnoteNumber) }}</sup>
        </template>
      </span>
    </p>
    <div
      v-if="wordsReady"
      dir="rtl"
      lang="ar"
      class="flex flex-wrap text-ink-strong [--mushaf-line-height:1.7] [&>.quran-word:last-child]:text-sage-600"
      :class="{ 'gap-x-[0.28em]': !isQcf }"
      :style="{ fontSize: arabicSize }"
    >
      <QuranWord v-for="word in verse.words" :key="word.position" :word="word" :is-font-loaded="isFontLoaded(word.page_number)" />
    </div>
    <div v-else dir="rtl" lang="ar" class="text-right font-arabic leading-[1.7] text-ink-strong" :style="{ fontSize: fallbackSize }">{{ arabicBody }}<span class="text-sage-600" :class="{ 'ayah-glow': isGlowing }">{{ arabicMark }}</span></div>
  </div>
</template>
