<script setup lang="ts">
/**
 * MushafReader — full-width reader with fullscreen button.
 *
 * Keyboard: ArrowRight → prev page, ArrowLeft → next page (RTL).
 * In spread mode a page turn moves a whole two-page spread.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { flipPage } from '~/composables/usePageFlip'
import { useMushafStore } from '~/stores/mushafStore'
import { useReaderSettingsStore } from '~/stores/readerSettingsStore'
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
}

const props = withDefaults(defineProps<Props>(), {
  uiVisible: true,
  spread: false,
  navLocked: false,
})

const emit = defineEmits<{ openTranslation: [verseKey: string] }>()

const mushafStore = useMushafStore()
const readerSettings = useReaderSettingsStore()

const currentPage = computed(() => mushafStore.currentPage)
const hasPrev = computed(() => mushafStore.hasPrevPage)
const hasNext = computed(() => mushafStore.hasNextPage)
const rightPage = computed(() => mushafStore.spreadPages[0])
const leftPage = computed(() => mushafStore.spreadPages[1])
const showColumns = computed(() => readerSettings.showPageTranslation)

function turn(direction: 'next' | 'prev') {
  const go = () => (direction === 'next' ? mushafStore.nextPage() : mushafStore.prevPage())
  if (props.spread) flipPage(direction, go)
  else go()
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

const touchStartX = ref(0)
const touchStartY = ref(0)

function handleTouchStart(e: TouchEvent) {
  if (e.changedTouches && e.changedTouches[0]) {
    touchStartX.value = e.changedTouches[0].screenX
    touchStartY.value = e.changedTouches[0].screenY
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (props.navLocked || !e.changedTouches || !e.changedTouches[0]) return

  const touchEndX = e.changedTouches[0].screenX
  const touchEndY = e.changedTouches[0].screenY

  const diffX = touchEndX - touchStartX.value
  const diffY = touchEndY - touchStartY.value

  // Threshold for swipe detection (50px)
  if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) {
      // Swipe Right -> Next (following RTL natural direction)
      if (hasNext.value) turn('next')
    }
    else {
      // Swipe Left -> Prev
      if (hasPrev.value) turn('prev')
    }
  }
}

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
    :class="spread ? 'overflow-hidden' : 'overflow-y-auto'"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
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
    <div v-else-if="spread" class="relative flex min-h-0 flex-1 px-6 pt-4 pb-10">
      <div class="paper-surface book-sheet flex min-w-0 flex-1 justify-center overflow-hidden [view-transition-name:book-spread]">
        <div class="flex min-w-0 flex-[1_1_0] justify-end">
          <MushafPageTranslationColumn v-if="showColumns" :page="leftPage" side="left" />
          <MushafFittedPage :page-number="leftPage" :is-font-loaded="isFontLoaded" />
        </div>
        <div
          aria-hidden="true"
          class="book-spine w-7 shrink-0"
        />
        <div class="flex min-w-0 flex-[1_1_0] justify-start">
          <MushafFittedPage :page-number="rightPage" :is-font-loaded="isFontLoaded" />
          <MushafPageTranslationColumn v-if="showColumns" :page="rightPage" side="right" />
        </div>
      </div>
      <div aria-hidden="true" class="book-spine-foot absolute bottom-[31px] left-1/2 h-[9px] w-7 -translate-x-1/2" />
    </div>

    <!-- Single page on a paper sheet; tapping an ayah opens its translation -->
    <!-- Phones: full-bleed paper so the Mushaf lines get the whole screen width -->
    <div v-else class="mushaf-page-wrapper md:p-2">
      <MushafPageView
        :page-number="currentPage"
        :is-font-loaded="isFontLoaded"
        sheet
        @word-click="emit('openTranslation', $event)"
      />
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
