<script setup lang="ts">
/**
 * MushafReader — full-width reader with fullscreen button.
 *
 * Keyboard: ArrowRight → prev page, ArrowLeft → next page (RTL).
 * In spread mode a page turn moves a whole two-page spread.
 */
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { flipPage, releaseDrag, sheetLayers, slideIn } from '~/composables/usePageFlip'
import { useSwipeTurn } from '~/composables/useSwipeTurn'
import { useMushafStore } from '~/stores/mushafStore'
import { useReaderSettingsStore } from '~/stores/readerSettingsStore'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { SELECTED_VERSE_KEY } from '~/composables/selectedVerse'
import {
  toggleFullscreen as toggleFullscreenHelper,
  getFullscreenElement,
} from '~/helpers/fullscreen'

interface Props {
  isFontLoaded: (pageNumber: number) => boolean
  uiVisible?: boolean
  spread?: boolean
  /** Blocks keyboard and swipe page turns (e.g. while the translation sheet is open) */
  navLocked?: boolean
  /** Fades the Mushaf spread out so the `sheet` slot's layer shows on the same paper */
  layerHidden?: boolean
  /** Single page with the translation pane beside it instead of the bottom sheet */
  pane?: boolean
  paneTranslation?: boolean
  /** The index takes the space right of the sheet, so the sheet gives way to it */
  indexOpen?: boolean
  /** Whether a page-edge click can turn on or back; the page knows, since the book layer has its own limits */
  canNext?: boolean
  canPrev?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  uiVisible: true,
  spread: false,
  pane: false,
  paneTranslation: true,
  navLocked: false,
  layerHidden: false,
  indexOpen: false,
  canNext: true,
  canPrev: true,
})

const emit = defineEmits<{ openTranslation: [verseKey: string]; edgeTurn: [direction: 'next' | 'prev'] }>()

const mushafStore = useMushafStore()
const readerSettings = useReaderSettingsStore()

const currentPage = computed(() => mushafStore.currentPage)
const hasPrev = computed(() => mushafStore.hasPrevPage)
const hasNext = computed(() => mushafStore.hasNextPage)
const rightPage = computed(() => mushafStore.spreadPages[0])
const leftPage = computed(() => mushafStore.spreadPages[1])
const showColumns = computed(() => readerSettings.showPageTranslation)

// Selecting only means something while a translation column is there to scroll to it
const columnVisible = computed(() => (props.spread ? showColumns.value : props.pane && props.paneTranslation))

// Tapping the selected verse again clears it
const focusedVerse = ref<{ key: string } | null>(null)
function focusVerse(key: string) {
  if (!columnVisible.value) return
  focusedVerse.value = focusedVerse.value?.key === key ? null : { key }
}
watch([currentPage, columnVisible, () => props.layerHidden], () => {
  focusedVerse.value = null
})
provide(SELECTED_VERSE_KEY, computed(() => focusedVerse.value?.key ?? null))
const fontSettings = useFontSettingsStore()

// Each layer keeps one width, so a mode switch only resizes the paper and
// crossfades the ink; neither layer re-lays itself out, not even for the index. The book is two
// 820px pages and the spine, scaled with the font size setting like everything in it.
// The Mushaf spread is as wide as its two pages, which follow the screen height,
// plus the translation columns at their 460px cap.
const INDEX_WIDTH = 284
const SPINE_WIDTH = 28
const COLUMN_MAX_WIDTH = 460
// Outer margin so a full-width column's text doesn't run to the paper's edge
const SHEET_MARGIN = 16
const pageSlotWidth = ref(0)
const mushafWidth = computed(() => {
  if (!pageSlotWidth.value) return 'var(--spread-avail)'
  const natural = 2 * (pageSlotWidth.value + SHEET_MARGIN) + SPINE_WIDTH + (showColumns.value ? 2 * COLUMN_MAX_WIDTH : 0)
  return `min(${natural}px, var(--spread-avail))`
})
const spreadVars = computed(() => ({
  // The book's sizes are drawn for 16px translation; at the default size (3) it reads at 14px
  '--book-scale': (14 / 16) * (1 + (fontSettings.fontScale - 3) * 0.12),
  '--spread-avail': '100cqw',
  '--book-width': `min(calc(var(--book-scale) * 1640px + ${SPINE_WIDTH}px), var(--spread-avail))`,
}))
const sheetWidth = computed(() => (props.layerHidden ? 'var(--book-width)' : mushafWidth.value))

// The index never resizes the sheet. The sheet slides left just far enough to clear
// it; where the screen is too narrow, the left page runs off the edge and fades out.
const spreadEl = ref<HTMLElement | null>(null)
const sheetEl = ref<HTMLElement | null>(null)
const spreadInner = ref(0)
const spreadPadding = ref(0)
const sheetPx = ref(0)
const FADE_WIDTH = 200
let sizeObserver: ResizeObserver | null = null

function measureSpread() {
  const el = spreadEl.value
  if (!el) return
  const style = getComputedStyle(el)
  spreadPadding.value = parseFloat(style.paddingLeft)
  spreadInner.value = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  sheetPx.value = sheetEl.value?.offsetWidth ?? 0
}

watch([spreadEl, sheetEl], ([spread, sheet], [oldSpread, oldSheet]) => {
  sizeObserver ??= new ResizeObserver(measureSpread)
  if (oldSpread) sizeObserver.unobserve(oldSpread)
  if (oldSheet) sizeObserver.unobserve(oldSheet)
  if (spread) sizeObserver.observe(spread)
  if (sheet) sizeObserver.observe(sheet)
  measureSpread()
})

const sheetShift = computed(() => {
  if (!props.indexOpen || !sheetPx.value) return 0
  return Math.max(0, INDEX_WIDTH - (spreadInner.value - sheetPx.value) / 2)
})
// How far the sheet's left edge passes the spread's left padding
const sheetOverflow = computed(() => Math.max(0, sheetShift.value - (spreadInner.value - sheetPx.value) / 2))
const sheetStyle = computed(() => {
  const style: Record<string, string> = { width: sheetWidth.value, transform: `translateX(-${sheetShift.value}px)` }
  if (sheetOverflow.value > 0) {
    const start = sheetOverflow.value
    style.maskImage = `linear-gradient(to right, transparent ${start}px, #000 ${start + FADE_WIDTH}px)`
  }
  return style
})
// Each edge zone reaches from just inside the paper out across the margin, up to
// EDGE_REACH, so on a full-width sheet it runs to the screen edge. The inside part
// stays under the translation column's 18px text inset.
const EDGE_INSIDE = 12
const EDGE_REACH = 96
const edgeWidth = computed(() => {
  const gutter = spreadPadding.value + (spreadInner.value - sheetPx.value) / 2
  return Math.min(Math.max(gutter - sheetShift.value, 0), EDGE_REACH) + EDGE_INSIDE
})

// Odd pages are the right page of a spread, even pages the left
const paneSide = computed(() => (currentPage.value % 2 === 1 ? 'right' : 'left'))

// The single page in the pane and phone layouts; the spread's layers are found in the sheet
const pageEl = ref<HTMLElement | null>(null)

function turn(direction: 'next' | 'prev') {
  const go = () => (direction === 'next' ? mushafStore.nextPage() : mushafStore.prevPage())
  if (props.spread) {
    flipPage(direction, go)
    return
  }
  releaseDrag()
  go()
  nextTick(() => {
    if (pageEl.value) slideIn([pageEl.value], direction)
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (props.navLocked || e.metaKey || e.ctrlKey || e.altKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    turn('prev')
  }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    turn('next')
  }
}

const swipe = useSwipeTurn({
  enabled: () => !props.navLocked,
  canTurn: direction => (direction === 'next' ? hasNext.value : hasPrev.value),
  layers: () => (props.spread ? sheetLayers() : pageEl.value ? [pageEl.value] : []),
  turn,
})

const isFullscreen = ref(false)

async function toggleFullscreen() {
  try {
    await toggleFullscreenHelper()
    isFullscreen.value = !!getFullscreenElement()
  }
  catch (err) {
    console.error(err)
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!getFullscreenElement()
}

const mounted = ref(false)

onMounted(() => {
  mounted.value = true
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('mozfullscreenchange', handleFullscreenChange)
  document.addEventListener('MSFullscreenChange', handleFullscreenChange)
})

onUnmounted(() => {
  sizeObserver?.disconnect()
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
})
</script>

<template>
  <div
    class="relative flex flex-1 flex-col"
    :class="spread ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto'"
    @touchstart.passive="swipe.onTouchStart"
    @touchmove.passive="swipe.onTouchMove"
    @touchend.passive="swipe.onTouchEnd"
    @touchcancel.passive="swipe.onTouchCancel"
  >
    <!-- Before hydration the viewport is unknown to JS; CSS picks two pages or one -->
    <template v-if="!mounted">
      <div class="relative hidden min-h-0 flex-1 px-6 pt-4 pb-10 spread:flex">
        <div class="paper-surface book-sheet flex min-w-0 flex-1 text-ink">
          <div class="flex flex-[1_1_0] items-center justify-center"><InkSpinner /></div>
          <div aria-hidden="true" class="book-spine w-7 shrink-0" />
          <div class="flex flex-[1_1_0] items-center justify-center"><InkSpinner /></div>
        </div>
        <div aria-hidden="true" class="book-spine-foot absolute bottom-[31px] left-1/2 h-[9px] w-7 -translate-x-1/2" />
      </div>
      <div class="paper-surface flex flex-1 items-center justify-center text-ink spread:hidden md:m-2 md:rounded-[4px] md:shadow-paper">
        <InkSpinner />
      </div>
    </template>

    <!-- Spread: [left translation] [left page] [fold] [right page] [right translation] -->
    <!-- One sheet and one spine for both layers, so switching to the book layer only crossfades the ink -->
    <div
      v-else-if="spread"
      ref="spreadEl"
      class="relative flex min-h-0 flex-1 justify-center px-6 pt-4 pb-10 [container-type:inline-size]"
      :style="spreadVars"
    >
      <div
        ref="sheetEl"
        class="relative z-10 shrink-0 transition-[width,transform] duration-300 ease-out motion-reduce:transition-none"
        :style="sheetStyle"
      >
        <div class="paper-surface book-sheet relative h-full overflow-hidden [view-transition-name:book-spread]">
          <div
            class="absolute inset-y-0 left-1/2 flex -translate-x-1/2 justify-center transition-[opacity,visibility] duration-300 ease-out motion-reduce:transition-none"
            :class="layerHidden ? 'invisible opacity-0' : ''"
            :style="{ width: 'var(--spread-avail)' }"
            :inert="layerHidden || undefined"
          >
            <div class="flex min-w-0 flex-[1_1_0] justify-end">
              <MushafPageTranslationColumn v-if="showColumns" :page="leftPage" side="left" :focused-verse="focusedVerse" />
              <MushafFittedPage :page-number="leftPage" :is-font-loaded="isFontLoaded" @slot-width="pageSlotWidth = $event" @word-click="focusVerse" />
            </div>
            <div aria-hidden="true" class="w-7 shrink-0" />
            <div class="flex min-w-0 flex-[1_1_0] justify-start">
              <MushafFittedPage :page-number="rightPage" :is-font-loaded="isFontLoaded" data-tour="page" @word-click="focusVerse" />
              <MushafPageTranslationColumn v-if="showColumns" :page="rightPage" side="right" :focused-verse="focusedVerse" />
            </div>
          </div>
          <slot name="sheet" />
          <div aria-hidden="true" class="pointer-events-none absolute inset-y-0 left-1/2 w-7 -translate-x-1/2">
            <div class="book-spine h-full" />
          </div>
        </div>
        <div aria-hidden="true" class="book-spine-foot absolute -bottom-[9px] left-1/2 h-[9px] w-7 -translate-x-1/2" />
        <MushafPageEdge
          side="left"
          :disabled="!canNext"
          data-tour="edge"
          :style="{ left: `${EDGE_INSIDE - edgeWidth}px`, width: `${edgeWidth}px` }"
          @turn="emit('edgeTurn', $event)"
        />
        <MushafPageEdge
          v-if="!indexOpen"
          side="right"
          :disabled="!canPrev"
          :style="{ right: `${EDGE_INSIDE - edgeWidth}px`, width: `${edgeWidth}px` }"
          @turn="emit('edgeTurn', $event)"
        />
      </div>
      <!-- Under the sheet, so the sheet uncovers it as it slides aside rather than the list showing through -->
      <div
        class="absolute top-4 right-6 bottom-10 z-0 overflow-hidden pl-6"
        :class="indexOpen ? '' : 'pointer-events-none'"
        :style="{ width: `${INDEX_WIDTH}px` }"
      >
        <slot name="aside" />
      </div>
    </div>

    <!-- Portrait tablets: one page with the translation pane on the side the page has in the spread -->
    <div v-else-if="pane" class="relative flex min-h-0 flex-1 px-6 pt-4 pb-6">
      <div ref="pageEl" class="paper-surface flex min-w-0 flex-1 justify-center overflow-hidden rounded-[4px] shadow-paper">
        <MushafPageTranslationColumn v-if="paneTranslation && paneSide === 'left'" :page="currentPage" side="left" :focused-verse="focusedVerse" />
        <MushafFittedPage :page-number="currentPage" :is-font-loaded="isFontLoaded" :fill="!paneTranslation" data-tour="page" @word-click="focusVerse" />
        <MushafPageTranslationColumn v-if="paneTranslation && paneSide === 'right'" :page="currentPage" side="right" :focused-verse="focusedVerse" />
      </div>
      <MushafPageEdge side="left" :disabled="!canNext" data-tour="edge" class="top-4 bottom-6 left-0 w-9" @turn="emit('edgeTurn', $event)" />
      <MushafPageEdge side="right" :disabled="!canPrev" class="top-4 bottom-6 right-0 w-9" @turn="emit('edgeTurn', $event)" />
    </div>

    <!-- Phones: single page on full-bleed paper; tapping an ayah opens its translation -->
    <div v-else ref="pageEl" class="mushaf-page-wrapper relative md:p-2">
      <MushafPageView
        :page-number="currentPage"
        :is-font-loaded="isFontLoaded"
        sheet
        data-tour="page"
        @word-click="emit('openTranslation', $event)"
      />
      <MushafPageEdge side="left" :disabled="!canNext" data-tour="edge" class="left-0 w-8" @turn="emit('edgeTurn', $event)" />
      <MushafPageEdge side="right" :disabled="!canPrev" class="right-0 w-8" @turn="emit('edgeTurn', $event)" />
    </div>

    <!-- Fullscreen button — bottom right -->
    <div class="nav-overlay" :class="{ 'nav-overlay--hidden': !uiVisible }">
      <button
        :aria-label="isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'"
        class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] bg-paper-pill text-ink-icon shadow-pill"
        @click="toggleFullscreen"
      >
        <svg
          v-if="!isFullscreen"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mushaf-page-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  container-type: size;
}

/* ── Overlay Nav ── */
.nav-overlay {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  display: flex;
  flex-direction: column;
  z-index: 20;
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;
}

.nav-overlay--hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
</style>
