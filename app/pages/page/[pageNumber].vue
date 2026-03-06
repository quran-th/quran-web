<script setup lang="ts">
/**
 * Mushaf page — /page/:pageNumber
 * Full-width layout with overlay navigation and progress bar.
 */
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useMushafStore } from '~/stores/mushafStore'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { useQcfFont } from '~/composables/useQcfFont'
import QuranToolbar from '~/components/reading/QuranToolbar.vue'

defineOptions({ layout: false }) // Mushaf uses its own full-screen layout

const route = useRoute()
const router = useRouter()
const mushafStore = useMushafStore()
const fontSettings = useFontSettingsStore()
const { currentPage, windowWords } = storeToRefs(mushafStore)
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

function handleBackClick() {
  router.push('/')
}

function handleSettingsClick() {
  showSettingsModal.value = true
}

function handlePageChange(page: number) {
  mushafStore.goToPage(page)
}

useHead({
  title: computed(() => `หน้า ${currentPage.value} - มุษอฟ - อัลกุรอานแปลไทย`),
})
</script>

<template>
  <div class="mushaf-container">
    <!-- Toolbar -->
    <QuranToolbar
      mode="page"
      :current-page="currentPage"
      :total-pages="mushafStore.totalPages"
      :is-ui-visible="isUiVisible"
      @back-click="handleBackClick"
      @settings-click="handleSettingsClick"
      @page-change="handlePageChange"
    />

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
</style>
