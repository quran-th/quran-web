<script setup lang="ts">
/**
 * MushafPageView — renders a single Mushaf page with its lines of QCF glyphs.
 * Transparent by default; `sheet` gives it the paper-sheet look.
 * Pages 1-2 use center alignment and don't stretch to fill full height.
 *
 * Applies the mushaf scale class (from mushaf-scales.css) at the page level
 * so --mushaf-font-size, --mushaf-line-height, and --mushaf-line-width
 * all cascade down to MushafLine and GlyphWord children.
 *
 * Surah headers (name glyph + bismillah) are injected before the first verse
 * line when a new surah starts on this page.
 */
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMushafStore } from "~/stores/mushafStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import type { QuranWord } from "~/types/quran";
import { getSurahNameGlyph } from "~/composables/useSurahNameGlyph";
import { MUSHAF_LOCKED_FONT, provideLockedQuranFont } from "~/composables/useQuranFont";

interface Props {
  pageNumber: number;
  isFontLoaded: (pageNumber: number) => boolean;
  /** Paper sheet styling for a standalone page (not inside a spread) */
  sheet?: boolean;
  /** Tighter footer so a full page fits its container height */
  compact?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ wordClick: [verseKey: string] }>();
const mushafStore = useMushafStore();
const fontSettings = useFontSettingsStore();
const { fontScale } = storeToRefs(fontSettings);

// Other fonts break the page's line alignment; the saved font still applies outside the Mushaf
provideLockedQuranFont(MUSHAF_LOCKED_FONT);

const lines = computed<Record<number, QuranWord[]>>(() => {
  return mushafStore.getPageLines(props.pageNumber);
});

const sortedLineNumbers = computed<number[]>(() => {
  return Object.keys(lines.value)
    .map(Number)
    .sort((a, b) => a - b);
});

const hasWords = computed(() => sortedLineNumbers.value.length > 0);

// Pages 1 and 2 have fewer words per line — center-align, don't stretch height
const isCentered = computed(() => props.pageNumber <= 2);

/** Maps to the V2 classes in mushaf-scales.css (e.g. "qcf-v2-scale-3") */
const scaleClass = computed(() => `qcf-v2-scale-${fontScale.value}`);

// ── Surah header detection ──

const surahStarts = computed(() => {
  return mushafStore.getSurahStartsOnPage(props.pageNumber);
});

/**
 * For each surah that starts on this page, compute:
 *  - The surah name glyph character
 *  - Whether to show bismillah
 *  - At which line the header should be inserted (before firstVerseLine)
 */
interface SurahHeaderInfo {
  surahId: number;
  glyph: string;
  showBismillah: boolean;
  insertBeforeLine: number;
}

const surahHeaders = computed<SurahHeaderInfo[]>(() => {
  return surahStarts.value.map((start) => ({
    surahId: start.surahId,
    glyph: getSurahNameGlyph(start.surahId),
    showBismillah: start.hasBismillah,
    insertBeforeLine: start.firstVerseLine,
  }));
});

/** Check if a surah header should be shown before a given line number. */
function getHeaderBeforeLine(lineNumber: number): SurahHeaderInfo | undefined {
  return surahHeaders.value.find((h) => h.insertBeforeLine === lineNumber);
}

// Bismillah words (loaded from 1:1 positions 1-4)
const bismillahWords = computed<QuranWord[]>(() => {
  return mushafStore.bismillahWords?.slice(0, 4) ?? [];
});
const hasBismillahWords = computed(() => bismillahWords.value.length === 4);
</script>

<template>
  <div
    class="mushaf-page"
    :class="[scaleClass, { 'paper-surface md:rounded-[4px] md:shadow-paper': sheet, 'mushaf-page--compact': compact }]"
  >
    <!-- Page content -->
    <div
      v-if="hasWords"
      class="mushaf-page-content"
      :class="{ 'mushaf-page-content--centered': isCentered }"
    >
      <template
        v-for="lineNum in sortedLineNumbers"
        :key="`p${pageNumber}-l${lineNum}`"
      >
        <!-- Surah header (name + bismillah) before the first verse line -->
        <div
          v-if="getHeaderBeforeLine(lineNum)"
          class="surah-header-block"
          dir="rtl"
        >
          <MushafSurahHeaderFrame class="my-[0.2em]">
            <span class="surah-name-pill">{{
              getHeaderBeforeLine(lineNum)!.glyph
            }}</span>
          </MushafSurahHeaderFrame>
          <!-- Bismillah (not for Surah 9) -->
          <MushafBismillahLine
            v-if="
              getHeaderBeforeLine(lineNum)!.showBismillah && hasBismillahWords
            "
            :words="bismillahWords"
            :is-font-loaded="isFontLoaded(1)"
          />
        </div>

        <!-- Regular verse line -->
        <MushafLine
          :words="lines[lineNum] ?? []"
          :is-font-loaded="isFontLoaded"
          :centered="isCentered"
          @word-click="emit('wordClick', $event)"
        />
      </template>
    </div>

    <!-- Loading spinner -->
    <div v-else class="mushaf-page-loading">
      <InkSpinner />
    </div>

    <!-- Page number footer -->
    <div class="mushaf-page-footer">
      {{ pageNumber }}
    </div>
  </div>
</template>

<style scoped>
.mushaf-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 0.5rem;
}

/* Tablet+: page width scales with font size via --mushaf-line-width */
@media (min-width: 768px) {
  .mushaf-page {
    max-width: var(--mushaf-line-width, 56cqh);
    padding: 0;
  }
}

/* Page lines: stack naturally using intrinsic line-height */
.mushaf-page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Pages 1-2 (few lines): vertically centered */
.mushaf-page-content--centered {
  gap: 0;
}

.mushaf-page--compact .mushaf-page-footer {
  margin-bottom: 0.5rem;
}

.mushaf-page-loading {
  flex: 1;
  color: #0c0a09;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mushaf-page-footer {
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  padding-top: 0.75rem;
  margin-bottom: 30px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ── Surah Header Block ── */

.surah-header-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.15em 0;
  width: 100%;
}

.surah-name-pill {
  font-family: "SurahNameV4", sans-serif;
  font-size: calc(var(--mushaf-font-size, 5.3vw) * 0.85);
  position: relative;
  z-index: 1;
  line-height: 1;
}

.bismillah-line {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  padding: 0.05em 0;
  direction: rtl;
  text-align: center;
  font-size: var(--mushaf-font-size, 5.3vw);
}
</style>
