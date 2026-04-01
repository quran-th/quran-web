<script setup lang="ts">
/**
 * MushafPageView — renders a single Mushaf page with its lines of QCF glyphs.
 * Full-width, no card styling. White background unified with the page.
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
import { QuranFont } from "~/types/quran";
import type { QuranWord } from "~/types/quran";
import { getSurahNameGlyph } from "~/composables/useSurahNameGlyph";

interface Props {
  pageNumber: number;
  isFontLoaded: (pageNumber: number) => boolean;
}

const props = defineProps<Props>();
const mushafStore = useMushafStore();
const fontSettings = useFontSettingsStore();
const { quranFont, fontScale } = storeToRefs(fontSettings);

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

/**
 * Build the mushaf scale CSS class name based on font type and scale level.
 * Maps to classes defined in mushaf-scales.css (e.g. "qcf-v2-scale-3").
 */
const scaleClass = computed(() => {
  const scale = fontScale.value;
  switch (quranFont.value) {
    case QuranFont.MadaniV1:
      return `qcf-v1-scale-${scale}`;
    case QuranFont.MadaniV2:
    case QuranFont.TajweedV4:
    default:
      return `qcf-v2-scale-${scale}`;
  }
});

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
  <div class="mushaf-page" :class="scaleClass">
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
          <!-- Surah name with double border + pill background -->
          <div class="surah-name-line">
            <span class="surah-name-pill">{{
              getHeaderBeforeLine(lineNum)!.glyph
            }}</span>
          </div>
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
        />
      </template>
    </div>

    <!-- Loading spinner -->
    <div v-else class="mushaf-page-loading">
      <svg
        fill="#0c0a09"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
      >
        <defs>
          <filter id="spinner-gF01">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="y" />
            <feColorMatrix
              in="y"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7"
              result="z"
            />
            <feBlend in="SourceGraphic" in2="z" />
          </filter>
        </defs>
        <g filter="url(#spinner-gF01)">
          <circle cx="5" cy="12" r="4">
            <animate
              attributeName="cx"
              calcMode="spline"
              dur="2s"
              values="5;8;5"
              keySplines=".36,.62,.43,.99;.79,0,.58,.57"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="19" cy="12" r="4">
            <animate
              attributeName="cx"
              calcMode="spline"
              dur="2s"
              values="19;16;19"
              keySplines=".36,.62,.43,.99;.79,0,.58,.57"
              repeatCount="indefinite"
            />
          </circle>
          <animateTransform
            attributeName="transform"
            type="rotate"
            dur="0.75s"
            values="0 12 12;360 12 12"
            repeatCount="indefinite"
          />
        </g>
      </svg>
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
  background: white;
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

.mushaf-page-loading {
  flex: 1;
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

.surah-name-line {
  display: flex;
  justify-content: center;
  align-items: center;
  direction: rtl;
  text-align: center;
  width: 100%;
  padding: 0.2em 0;
  background:
    radial-gradient(
      circle at bottom,
      transparent 24%,
      rgb(203, 196, 161) 25%,
      rgb(203, 196, 161) 30%,
      transparent 31%,
      transparent 39%,
      rgb(203, 196, 161) 40%,
      rgb(203, 196, 161) 45%,
      transparent 46%
    ),
    radial-gradient(
      circle at top,
      transparent 24%,
      rgb(203, 196, 161) 25%,
      rgb(203, 196, 161) 30%,
      transparent 31%,
      transparent 39%,
      rgb(203, 196, 161) 40%,
      rgb(203, 196, 161) 45%,
      transparent 46%
    ),
    radial-gradient(
      circle at left,
      transparent 24%,
      rgb(203, 196, 161) 25%,
      rgb(203, 196, 161) 30%,
      transparent 31%,
      transparent 39%,
      rgb(203, 196, 161) 40%,
      rgb(203, 196, 161) 45%,
      transparent 46%
    ),
    radial-gradient(
      circle at right,
      transparent 24%,
      rgb(203, 196, 161) 25%,
      rgb(203, 196, 161) 30%,
      transparent 31%,
      transparent 39%,
      rgb(203, 196, 161) 40%,
      rgb(203, 196, 161) 45%,
      transparent 46%
    );
  background-size: 1em 1em;
  background-color: rgb(218, 210, 177);
  opacity: 1;
  border-radius: 5px;
}

.surah-name-pill {
  font-family: "SurahNameV4", sans-serif;
  font-size: calc(var(--mushaf-font-size, 5.3vw) * 0.85);
  position: relative;
  min-width: 7em;
  z-index: 1;
  padding: 0.15em 1em;
  border-radius: 999px;
  background-color: white;
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
