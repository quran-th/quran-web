<script setup lang="ts">
/**
 * Mushaf page — /page/:pageNumber
 * Full-width layout with overlay navigation and progress bar.
 */
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useMushafStore } from '~/stores/mushafStore'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { useQcfFont } from '~/composables/useQcfFont'

defineOptions({ layout: false }) // Mushaf uses its own full-screen layout

const route = useRoute()
const router = useRouter()
const mushafStore = useMushafStore()
const fontSettings = useFontSettingsStore()
const { currentPage, loading, windowWords } = storeToRefs(mushafStore)
const { fontVersion } = storeToRefs(fontSettings)

// Load QCF fonts for the visible window of pages
const { isFontLoaded } = useQcfFont(windowWords, fontVersion)

// Settings modal
const showSettingsModal = ref(false)

const isUiVisible = ref(true)
let uiTimer: ReturnType<typeof setTimeout> | undefined

function resetUiTimer() {
  isUiVisible.value = true
  clearTimeout(uiTimer)
  uiTimer = setTimeout(() => {
    isUiVisible.value = false
  }, 3000)
}

const progressPercent = computed(() =>
  ((currentPage.value / mushafStore.totalPages) * 100).toFixed(2)
)

onMounted(() => {
  const pageNum = parseInt(route.params.pageNumber as string) || 1
  mushafStore.loadWindow(pageNum)

  resetUiTimer()
  window.addEventListener('mousemove', resetUiTimer)
  window.addEventListener('touchstart', resetUiTimer)
  window.addEventListener('scroll', resetUiTimer)
  window.addEventListener('click', resetUiTimer)
})

onUnmounted(() => {
  clearTimeout(uiTimer)
  window.removeEventListener('mousemove', resetUiTimer)
  window.removeEventListener('touchstart', resetUiTimer)
  window.removeEventListener('scroll', resetUiTimer)
  window.removeEventListener('click', resetUiTimer)
})

// Sync route param ↔ store
watch(
  () => route.params.pageNumber,
  (newPage) => {
    if (newPage) {
      const pg = parseInt(newPage as string)
      if (pg !== currentPage.value && pg >= 1 && pg <= mushafStore.totalPages) {
        mushafStore.loadWindow(pg)
      }
    }
  }
)

// Update URL when page changes via keyboard/click
watch(currentPage, (newPage) => {
  const routeParam = parseInt(route.params.pageNumber as string)
  if (newPage !== routeParam) {
    router.replace({ params: { pageNumber: String(newPage) } })
  }
})

function handleGoToPage(e: Event) {
  const input = e.target as HTMLInputElement
  const pg = parseInt(input.value)
  if (pg >= 1 && pg <= mushafStore.totalPages) {
    mushafStore.goToPage(pg)
  }
}

useHead({
  title: computed(() => `หน้า ${currentPage.value} - มุษอฟ - อัลกุรอานแปลไทย`),
})
</script>

<template>
  <div class="mushaf-container">
    <!-- Toolbar -->
    <header class="mushaf-toolbar" :class="{ 'mushaf-toolbar--hidden': !isUiVisible }">
      <div class="toolbar-left">
        <NuxtLink to="/" class="toolbar-back" title="กลับ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </NuxtLink>
      </div>

      <div class="toolbar-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toolbar-icon">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M8 7h6" />
          <path d="M8 11h8" />
        </svg>
        <span class="toolbar-page-info">
          หน้า
          <input
            type="number"
            :value="currentPage"
            min="1"
            :max="mushafStore.totalPages"
            class="page-input"
            @change="handleGoToPage"
          >
        </span>
        <span class="toolbar-divider">·</span>
        <span class="toolbar-meta">ญุซที่ {{ Math.ceil(currentPage / 20) }}</span>
      </div>

      <div class="toolbar-right">
        <button class="toolbar-icon-btn" title="ตั้งค่าตัวอักษร" @click="showSettingsModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- Progress bar -->
      <div class="toolbar-progress">
        <div class="toolbar-progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
    </header>

    <!-- Reader -->
    <MushafReader :is-font-loaded="isFontLoaded" :ui-visible="isUiVisible" />

    <!-- Font Settings Modal -->
    <SettingsFontSettingsModal v-model:visible="showSettingsModal" />
  </div>
</template>

<style scoped>
.mushaf-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  height: 100vh;
  background: white;
  overflow: hidden;
}

/* ── Toolbar ── */
.mushaf-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  z-index: 10;
  transition: transform 0.3s ease;
}

.mushaf-toolbar--hidden {
  transform: translateY(-100%);
}

.toolbar-left { display: flex; align-items: center; gap: 0.5rem; }

.toolbar-back {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s;
}

.toolbar-back:hover { color: #1e293b; }

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #64748b;
}

.toolbar-icon { color: #94a3b8; }

.toolbar-page-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-input {
  width: 40px;
  padding: 0.1rem 0.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  text-align: center;
  font-size: 0.85rem;
  color: #334155;
  background: #f8fafc;
  -moz-appearance: textfield;
}

.page-input::-webkit-outer-spin-button,
.page-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.toolbar-divider { color: #cbd5e1; margin: 0 0.15rem; }
.toolbar-meta { color: #94a3b8; }
.toolbar-right { display: flex; align-items: center; gap: 0.35rem; }

.toolbar-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-icon-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

/* ── Progress Bar ── */
.toolbar-progress {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: #f1f5f9;
}

.toolbar-progress-fill {
  height: 100%;
  background: #0ea5e9;
  border-radius: 0 1px 1px 0;
  transition: width 0.3s ease;
}
</style>
