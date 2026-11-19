<script setup lang="ts">
/**
 * Mushaf page — /page/:pageNumber
 * Full-width layout with a reader header. Wide landscape screens show a two-page
 * spread with translation columns; narrower screens show one page and open the
 * translation in a bottom sheet on demand.
 */
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useMushafStore } from "~/stores/mushafStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useRecitationStore } from "~/stores/recitationStore";
import type { Verse } from "~/stores/quranStore";
import ReportModal from "~/components/reading/ReportModal.vue";
import { useQcfFont } from "~/composables/useQcfFont";
import { flipPage } from "~/composables/usePageFlip";
import { useSpreadMode } from "~/composables/useSpreadMode";
import { useFootnotePopover } from "~/composables/useFootnotePopover";

// Mushaf uses its own full-screen layout; a fixed key keeps the reader mounted across page turns so the view transition survives the URL sync
definePageMeta({ layout: false, key: "mushaf-page" });

const route = useRoute();
const router = useRouter();
const mushafStore = useMushafStore();
const fontSettings = useFontSettingsStore();
const readerSettings = useReaderSettingsStore();
const recitation = useRecitationStore();
const { currentPage, windowWords } = storeToRefs(mushafStore);
const { fontVersion } = storeToRefs(fontSettings);
const { showPageTranslation, selectedSourceId } = storeToRefs(readerSettings);

// Load QCF fonts for the visible window of pages
const { isFontLoaded } = useQcfFont(windowWords, fontVersion);

const isUiVisible = ref(true);
let uiTimer: ReturnType<typeof setTimeout> | undefined;

function resetUiTimer() {
  isUiVisible.value = true;
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    isUiVisible.value = false;
  }, 3000);
}

const isSpread = useSpreadMode();

// Start on the URL's page so the first paint (SSR included) already names it, not page 1
const initialPage = Math.min(Math.max(parseInt(route.params.pageNumber as string) || 1, 1), mushafStore.totalPages);
mushafStore.currentPage = isSpread.value && initialPage % 2 === 0 ? initialPage - 1 : initialPage;

const sheetOpen = ref(false);
const sheetVerseKey = ref<string | undefined>();

function openSheet(verseKey?: string) {
  sheetVerseKey.value = verseKey;
  sheetOpen.value = true;
}

function closeSheet() {
  sheetOpen.value = false;
}

function handleToggleTranslation() {
  if (isSpread.value) {
    readerSettings.setShowPageTranslation(!showPageTranslation.value);
  }
  else if (sheetOpen.value) {
    closeSheet();
  }
  else {
    openSheet();
  }
}

const translationOn = computed(() => (isSpread.value ? showPageTranslation.value : sheetOpen.value));

const rangeLabel = computed(() => {
  if (!isSpread.value) return `หน้า ${currentPage.value}`;
  const [odd, even] = mushafStore.spreadPages;
  return `หน้า ${odd}–${even}`;
});

function turn(direction: "next" | "prev") {
  const go = () => (direction === "next" ? mushafStore.nextPage() : mushafStore.prevPage());
  if (isSpread.value) flipPage(direction, go);
  else go();
}

const showSettings = ref(false);
const showReport = ref(false);
const reportVerse = ref<Verse | null>(null);
const reportSurah = ref(1);
const reportCategories = ref<string[]>([]);
const { footnotePopoverOpen } = useFootnotePopover();

provide("openReport", (verse: Verse, categories: string[] = []) => {
  reportVerse.value = verse;
  reportSurah.value = verse.surahNumber ?? reportSurah.value;
  reportCategories.value = categories;
  showReport.value = true;
});

const firstKey = computed(() => mushafStore.currentPageVerseKeys[0]);
const firstVerse = computed(() => {
  if (!firstKey.value) return null;
  const [surah, verse] = firstKey.value.split(":").map(Number);
  return { surah: surah!, verse: verse! };
});

const headerLinks = computed(() => ({
  mushaf: `/page/${currentPage.value}`,
  ayah: firstVerse.value ? `/${firstVerse.value.surah}/${firstVerse.value.verse}` : undefined,
  // Book mode needs a wide screen; narrow screens would just land in the ayah reader
  book: isSpread.value && firstVerse.value ? `/${firstVerse.value.surah}/${firstVerse.value.verse}?mode=book` : undefined,
}));

// Prefetch on page change: iOS only allows audio playback started from a user gesture
watch(
  () => firstVerse.value?.surah,
  (surah) => {
    if (!surah) return;
    recitation.loadTimings(surah);
    recitation.loadTranslation(surah);
  },
  { immediate: true },
);

function handleListen() {
  if (!firstVerse.value) return;
  recitation.playVerse(firstVerse.value.surah, firstVerse.value.verse);
}

async function handleReport() {
  if (!firstVerse.value || !firstKey.value) return;
  try {
    const res = await $fetch<{ success: boolean; data: { verses: Verse[] } }>("/api/verses/by-keys", {
      method: "POST",
      body: { keys: [firstKey.value], sourceId: selectedSourceId.value },
    });
    const verse = res.success ? res.data.verses[0] : undefined;
    if (!verse) return;
    reportVerse.value = verse;
    reportSurah.value = firstVerse.value.surah;
    reportCategories.value = [];
    showReport.value = true;
  }
  catch (e) {
    console.error("Failed to load verse for report:", e);
  }
}

// In spread mode the store normalises an even page to its odd partner
function syncUrl() {
  if (currentPage.value !== parseInt(route.params.pageNumber as string)) {
    router.replace({ params: { pageNumber: String(currentPage.value) } });
  }
}

onMounted(() => {
  const pageNum = Math.min(Math.max(parseInt(route.params.pageNumber as string) || 1, 1), mushafStore.totalPages);
  mushafStore.spreadMode = isSpread.value;
  mushafStore.loadWindow(pageNum);
  syncUrl();
  readerSettings.fetchTranslationSources();

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
        syncUrl();
      }
    }
  },
);

// Update URL when page changes via keyboard/click
watch(currentPage, syncUrl);

watch(isSpread, (spread) => {
  closeSheet();
  mushafStore.spreadMode = spread;
  mushafStore.loadWindow(currentPage.value);
});

useSeoMeta({
  title: computed(() => `หน้า ${currentPage.value} - มุศฮัฟ - อัลกุรอานแปลไทย`),
  ogTitle: computed(() => `หน้า ${currentPage.value} - มุศฮัฟ - อัลกุรอานแปลไทย`),
  description: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  ogDescription: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div class="flex h-screen min-h-screen flex-col overflow-hidden bg-paper-surround">
    <ReadingReaderHeader
      mode="mushaf"
      :links="headerLinks"
      :translation-on="translationOn"
      :range-label="rangeLabel"
      :has-prev="mushafStore.hasPrevPage"
      :has-next="mushafStore.hasNextPage"
      back-to="/"
      @toggle-translation="handleToggleTranslation"
      @prev="turn('prev')"
      @next="turn('next')"
      @listen="handleListen"
      @report="handleReport"
      @settings="showSettings = true"
    />

    <MushafReader
      :is-font-loaded="isFontLoaded"
      :ui-visible="isUiVisible"
      :spread="isSpread"
      :nav-locked="sheetOpen || showSettings || showReport || footnotePopoverOpen"
      @open-translation="openSheet"
    />

    <MushafPageTranslationSheet
      :open="sheetOpen"
      :page="currentPage"
      :verse-key="sheetVerseKey"
      @close="closeSheet"
    />

    <SettingsReaderSettingsModal v-model:visible="showSettings" />
    <ReportModal
      v-if="reportVerse"
      v-model:visible="showReport"
      :verse="reportVerse"
      :surah-number="reportSurah"
      :source-id="selectedSourceId"
      :initial-categories="reportCategories"
    />
    <ClientOnly>
      <ReadingRecitationPlayerBar />
    </ClientOnly>
  </div>
</template>
