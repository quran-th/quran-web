<script setup lang="ts">
/**
 * Mushaf page — /page/:pageNumber
 * Full-width layout with overlay navigation and progress bar.
 */
import { storeToRefs } from "pinia";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useMushafStore } from "~/stores/mushafStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useQcfFont } from "~/composables/useQcfFont";
// TODO: re-enable when QuranToolbar is unhidden
// import QuranToolbar from "~/components/reading/QuranToolbar.vue";

defineOptions({ layout: false }); // Mushaf uses its own full-screen layout

const route = useRoute();
const router = useRouter();
const mushafStore = useMushafStore();
const fontSettings = useFontSettingsStore();
const { currentPage, windowWords } = storeToRefs(mushafStore);
const { fontVersion } = storeToRefs(fontSettings);

// Load QCF fonts for the visible window of pages
const { isFontLoaded } = useQcfFont(windowWords, fontVersion);

const readingMode = ref<"mushaf" | "translation">("mushaf");

const isUiVisible = ref(true);
let uiTimer: ReturnType<typeof setTimeout> | undefined;

function resetUiTimer() {
  isUiVisible.value = true;
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    isUiVisible.value = false;
  }, 3000);
}

onMounted(() => {
  const pageNum = parseInt(route.params.pageNumber as string) || 1;
  mushafStore.loadWindow(pageNum);

  resetUiTimer();
  window.addEventListener("mousemove", resetUiTimer);
  window.addEventListener("touchstart", resetUiTimer);
  window.addEventListener("scroll", resetUiTimer);
  window.addEventListener("click", resetUiTimer);
});

onUnmounted(() => {
  clearTimeout(uiTimer);
  window.removeEventListener("mousemove", resetUiTimer);
  window.removeEventListener("touchstart", resetUiTimer);
  window.removeEventListener("scroll", resetUiTimer);
  window.removeEventListener("click", resetUiTimer);
});

// Sync route param ↔ store
watch(
  () => route.params.pageNumber,
  (newPage) => {
    if (newPage) {
      const pg = parseInt(newPage as string);
      if (pg !== currentPage.value && pg >= 1 && pg <= mushafStore.totalPages) {
        mushafStore.loadWindow(pg);
      }
    }
  },
);

// Update URL when page changes via keyboard/click
watch(currentPage, (newPage) => {
  const routeParam = parseInt(route.params.pageNumber as string);
  if (newPage !== routeParam) {
    router.replace({ params: { pageNumber: String(newPage) } });
  }
});

// TODO: re-enable when QuranToolbar is unhidden
// function handleBackClick() {
//   router.push("/");
// }
// function handleSettingsClick() {
//   showSettingsModal.value = true;
// }
// function handlePageChange(page: number) {
//   mushafStore.goToPage(page);
// }
// function toggleReadingMode() {
//   readingMode.value = readingMode.value === "mushaf" ? "translation" : "mushaf";
// }

useSeoMeta({
  title: computed(() => `หน้า ${currentPage.value} - มุศฮัฟ - อัลกุรอานแปลไทย`),
  ogTitle: computed(() => `หน้า ${currentPage.value} - มุศฮัฟ - อัลกุรอานแปลไทย`),
  description: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  ogDescription: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div
    :class="[
      'page-container',
      readingMode === 'mushaf' ? 'mushaf-mode' : 'translation-mode',
    ]"
  >
    <!-- TODO: temporarily hidden -->
    <!-- <QuranToolbar
      mode="page"
      :current-page="currentPage"
      :total-pages="mushafStore.totalPages"
      :is-ui-visible="isUiVisible"
      :reading-mode="readingMode"
      @back-click="handleBackClick"
      @settings-click="handleSettingsClick"
      @page-change="handlePageChange"
      @toggle-mode="toggleReadingMode"
    /> -->

    <!-- Reader -->
    <ReadingPageTranslationReader v-if="readingMode === 'translation'" />
    <MushafReader
      v-else
      :is-font-loaded="isFontLoaded"
      :ui-visible="isUiVisible"
    />

  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  background: white;
}

.mushaf-mode {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
}

.translation-mode {
  min-height: 100vh;
  overflow: auto;
}
</style>
