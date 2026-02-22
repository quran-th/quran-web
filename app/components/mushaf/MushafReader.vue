<script setup lang="ts">
/**
 * MushafReader — full-width reader with overlay navigation arrows.
 *
 * Keyboard: ArrowRight → prev page, ArrowLeft → next page (RTL).
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMushafStore } from '~/stores/mushafStore'
import {
  toggleFullscreen as toggleFullscreenHelper,
  getFullscreenElement,
} from '~/helpers/fullscreen'

interface Props {
  isFontLoaded: (pageNumber: number) => boolean
  uiVisible?: boolean
}

withDefaults(defineProps<Props>(), {
  uiVisible: true,
})

const mushafStore = useMushafStore()

const currentPage = computed(() => mushafStore.currentPage)
const hasPrev = computed(() => currentPage.value > 1)
const hasNext = computed(() => currentPage.value < mushafStore.totalPages)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    mushafStore.prevPage()
  }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    mushafStore.nextPage()
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
  if (!e.changedTouches || !e.changedTouches[0]) return

  const touchEndX = e.changedTouches[0].screenX
  const touchEndY = e.changedTouches[0].screenY

  const diffX = touchEndX - touchStartX.value
  const diffY = touchEndY - touchStartY.value

  // Threshold for swipe detection (50px)
  if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) {
      // Swipe Right -> Next (following RTL natural direction)
      if (hasNext.value) mushafStore.nextPage()
    }
    else {
      // Swipe Left -> Prev
      if (hasPrev.value) mushafStore.prevPage()
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

onMounted(() => {
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
  <div class="mushaf-reader" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
    <!-- Full-width page display -->
    <div class="mushaf-page-wrapper">
      <MushafPageView :page-number="currentPage" :is-font-loaded="isFontLoaded" />
    </div>

    <!-- Overlay navigation arrows — bottom right -->
    <div class="nav-overlay" :class="{ 'nav-overlay--hidden': !uiVisible }">
      <button class="nav-arrow" title="Toggle Fullscreen" @click="toggleFullscreen">
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
      <button
        :disabled="!hasPrev"
        class="nav-arrow"
        title="Previous page"
        @click="mushafStore.prevPage()"
      >
        <svg
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
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        :disabled="!hasNext"
        class="nav-arrow"
        title="Next page"
        @click="mushafStore.nextPage()"
      >
        <svg
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mushaf-reader {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
  gap: 0.35rem;
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

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  cursor: pointer;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease;
}

.nav-arrow:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
