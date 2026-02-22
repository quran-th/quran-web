<script setup lang="ts">
/**
 * MushafPageView — renders a single Mushaf page with its lines of QCF glyphs.
 * Full-width, no card styling. White background unified with the page.
 * Pages 1-2 use center alignment and don't stretch to fill full height.
 */
import { computed } from 'vue'
import { useMushafStore } from '~/stores/mushafStore'
import type { QuranWord } from '~/types/quran'

interface Props {
  pageNumber: number
  isFontLoaded: (pageNumber: number) => boolean
}

const props = defineProps<Props>()
const mushafStore = useMushafStore()

const lines = computed<Record<number, QuranWord[]>>(() => {
  return mushafStore.getPageLines(props.pageNumber)
})

const sortedLineNumbers = computed<number[]>(() => {
  return Object.keys(lines.value)
    .map(Number)
    .sort((a, b) => a - b)
})

const hasWords = computed(() => sortedLineNumbers.value.length > 0)

// Pages 1 and 2 have fewer words per line — center-align, don't stretch height
const isCentered = computed(() => props.pageNumber <= 2)
</script>

<template>
  <div class="mushaf-page">
    <!-- Page content -->
    <div
      v-if="hasWords"
      class="mushaf-page-content"
      :class="{ 'mushaf-page-content--centered': isCentered }"
    >
      <MushafLine
        v-for="lineNum in sortedLineNumbers"
        :key="`p${pageNumber}-l${lineNum}`"
        :words="lines[lineNum] ?? []"
        :is-font-loaded="isFontLoaded"
        :centered="isCentered"
      />
    </div>

    <!-- Loading spinner -->
    <div v-else class="mushaf-page-loading">
      <svg fill="#0c0a09" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
        <defs>
          <filter id="spinner-gF01">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="y" />
            <feColorMatrix in="y" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7" result="z" />
            <feBlend in="SourceGraphic" in2="z" />
          </filter>
        </defs>
        <g filter="url(#spinner-gF01)">
          <circle cx="5" cy="12" r="4">
            <animate attributeName="cx" calcMode="spline" dur="2s" values="5;8;5" keySplines=".36,.62,.43,.99;.79,0,.58,.57" repeatCount="indefinite" />
          </circle>
          <circle cx="19" cy="12" r="4">
            <animate attributeName="cx" calcMode="spline" dur="2s" values="19;16;19" keySplines=".36,.62,.43,.99;.79,0,.58,.57" repeatCount="indefinite" />
          </circle>
          <animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite" />
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

/* Tablet+: cqh-based page width (matches container height scaling) */
@media (min-width: 768px) {
  .mushaf-page {
    max-width: 56cqh;
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
</style>
