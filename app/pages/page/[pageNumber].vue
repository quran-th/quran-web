<script setup lang="ts">
/**
 * Mushaf page — /page/:pageNumber, and the bilingual book at ?mode=book&ayah=S:V
 * Full-width layout with a reader header. Wide landscape screens show a two-page
 * spread that switches in place between the Mushaf and the book; narrower screens
 * show one Mushaf page and open the translation in a bottom sheet on demand.
 */
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useMushafStore } from "~/stores/mushafStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useQuranStore } from "~/stores/quranStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useRecitationStore } from "~/stores/recitationStore";
import type { Verse } from "~/stores/quranStore";
import type BookSpread from "~/components/book/BookSpread.vue";
import type { BookPosition } from "~/components/book/BookSpread.vue";
import ReportModal from "~/components/reading/ReportModal.vue";
import { useQcfFont } from "~/composables/useQcfFont";
import { flipPage } from "~/composables/usePageFlip";
import { usePaneMode, useSpreadMode } from "~/composables/useSpreadMode";
import { useFootnotePopover } from "~/composables/useFootnotePopover";

type SpreadMode = "mushaf" | "book";

// Mushaf uses its own full-screen layout; a fixed key keeps the reader mounted across page turns and mode switches
definePageMeta({ layout: false, key: "mushaf-page" });

const route = useRoute();
const router = useRouter();
const mushafStore = useMushafStore();
const quranStore = useQuranStore();
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
const isPane = usePaneMode();

// Start on the URL's page so the first paint (SSR included) already names it, not page 1
const initialPage = Math.min(Math.max(parseInt(route.params.pageNumber as string) || 1, 1), mushafStore.totalPages);
mushafStore.currentPage = isSpread.value && initialPage % 2 === 0 ? initialPage - 1 : initialPage;

interface VersePosition { surah: number; verse: number }

function parseVerseKey(key: unknown): VersePosition | null {
  const match = typeof key === "string" ? /^(\d+):(\d+)$/.exec(key) : null;
  if (!match) return null;
  const surah = Number(match[1]);
  const verse = Number(match[2]);
  return surah >= 1 && surah <= 114 && verse >= 1 ? { surah, verse } : null;
}

// Book mode needs the spread; elsewhere a ?mode=book URL just reads as the Mushaf
const requestedMode = ref<SpreadMode>(route.query.mode === "book" ? "book" : "mushaf");
const mode = computed<SpreadMode>(() => (isSpread.value && requestedMode.value === "book" ? "book" : "mushaf"));

// The shared reading position. Only the visible layer moves it, so switching
// modes back and forth never drifts: the hidden layer just follows along.
const position = ref<VersePosition | null>(parseVerseKey(route.query.ayah));

const sheetOpen = ref(false);
const sheetVerseKey = ref<string | undefined>();

function openSheet(verseKey?: string) {
  sheetVerseKey.value = verseKey;
  sheetOpen.value = true;
}

function closeSheet() {
  sheetOpen.value = false;
}

// Tablets hide the pane only for this visit, so the spread's saved setting is never touched
const paneTranslation = ref(true);

function handleToggleTranslation() {
  if (isSpread.value) {
    readerSettings.setShowPageTranslation(!showPageTranslation.value);
  }
  else if (isPane.value) {
    paneTranslation.value = !paneTranslation.value;
  }
  else if (sheetOpen.value) {
    closeSheet();
  }
  else {
    openSheet();
  }
}

const translationOn = computed(() => {
  if (isSpread.value) return showPageTranslation.value;
  return isPane.value ? paneTranslation.value : sheetOpen.value;
});

const showSettings = ref(false);
const showReport = ref(false);
const reportVerse = ref<Verse | null>(null);
const reportSurah = ref(1);
const reportCategories = ref<string[]>([]);
const { footnotePopoverOpen } = useFootnotePopover();
const modalOpen = computed(() => showSettings.value || showReport.value || footnotePopoverOpen.value);

provide("openReport", (verse: Verse, categories: string[] = []) => {
  reportVerse.value = verse;
  reportSurah.value = verse.surahNumber ?? reportSurah.value;
  reportCategories.value = categories;
  showReport.value = true;
});

const firstKey = computed(() => mushafStore.currentPageVerseKeys[0]);
const firstVerse = computed(() => parseVerseKey(firstKey.value));

watch(firstVerse, (verse) => {
  if (verse && (mode.value === "mushaf" || !position.value)) position.value = verse;
}, { immediate: true });

// ── Book layer ──

const bookRef = ref<InstanceType<typeof BookSpread> | null>(null);
const bookPosition = ref<BookPosition | null>(null);
// Mounted ahead of time once the page is idle, so the first switch is already paginated
const bookWarm = ref(requestedMode.value === "book");

const bookSurah = computed(() => {
  const id = position.value?.surah;
  const surah = id ? quranStore.surahs.find(s => s.id === id) : undefined;
  return surah
    ? {
        nameArabic: surah.name_arabic,
        nameThai: surah.name_thai,
        revelationPlace: surah.revelation_place,
        versesCount: surah.verses_count,
      }
    : null;
});

function handleBookPosition(next: BookPosition) {
  bookPosition.value = next;
  if (mode.value !== "book") return;
  position.value = { surah: next.surah, verse: next.firstVerse };
  if (next.page && !mushafStore.spreadPages.includes(next.page)) mushafStore.loadWindow(next.page);
}

function handleBookCross(direction: "next" | "prev") {
  const surah = (position.value?.surah ?? 0) + (direction === "next" ? 1 : -1);
  const target = quranStore.surahs.find(s => s.id === surah);
  if (!target) return;
  bookPosition.value = null;
  position.value = { surah, verse: direction === "next" ? 1 : target.verses_count };
}

function setMode(next: SpreadMode) {
  if (next === "book") bookWarm.value = true;
  requestedMode.value = next;
}

watch(() => route.query.mode, (queryMode) => {
  setMode(queryMode === "book" ? "book" : "mushaf");
});

// ── Header ──

const rangeLabel = computed(() => {
  if (mode.value === "book") {
    const book = bookPosition.value;
    if (!book) return undefined;
    return book.firstVerse === book.lastVerse ? `อายะห์ ${book.firstVerse}` : `อายะห์ ${book.firstVerse}–${book.lastVerse}`;
  }
  if (!isSpread.value) return `หน้า ${currentPage.value}`;
  const [odd, even] = mushafStore.spreadPages;
  return `หน้า ${odd}–${even}`;
});

const hasPrev = computed(() => {
  if (mode.value === "mushaf") return mushafStore.hasPrevPage;
  const book = bookPosition.value;
  return !!book && (!book.atStart || book.surah > 1);
});

const hasNext = computed(() => {
  if (mode.value === "mushaf") return mushafStore.hasNextPage;
  const book = bookPosition.value;
  return !!book && (!book.atEnd || book.surah < 114);
});

function turn(direction: "next" | "prev") {
  if (mode.value === "book") {
    bookRef.value?.[direction]();
    return;
  }
  const go = () => (direction === "next" ? mushafStore.nextPage() : mushafStore.prevPage());
  if (isSpread.value) flipPage(direction, go);
  else go();
}

// Prefetch on page change: iOS only allows audio playback started from a user gesture
watch(
  () => position.value?.surah,
  (surah) => {
    if (!surah) return;
    recitation.loadTimings(surah);
    recitation.loadTranslation(surah);
  },
  { immediate: true },
);

function handleListen() {
  if (!position.value) return;
  recitation.playVerse(position.value.surah, position.value.verse);
}

async function handleReport() {
  const at = position.value;
  if (!at) return;
  try {
    const res = await $fetch<{ success: boolean; data: { verses: Verse[] } }>("/api/verses/by-keys", {
      method: "POST",
      body: { keys: [`${at.surah}:${at.verse}`], sourceId: selectedSourceId.value },
    });
    const verse = res.success ? res.data.verses[0] : undefined;
    if (!verse) return;
    reportVerse.value = verse;
    reportSurah.value = at.surah;
    reportCategories.value = [];
    showReport.value = true;
  }
  catch (e) {
    console.error("Failed to load verse for report:", e);
  }
}

// ── URL ──

// In spread mode the store normalises an even page to its odd partner. Book mode
// adds the verse, since a book spread can start partway down a Mushaf page.
function syncUrl() {
  const { mode: _mode, ayah: _ayah, ...rest } = route.query;
  const query: Record<string, unknown> = { ...rest };
  if (requestedMode.value === "book") {
    query.mode = "book";
    if (position.value) query.ayah = `${position.value.surah}:${position.value.verse}`;
  }
  const page = String(currentPage.value);
  if (
    page !== route.params.pageNumber
    || query.mode !== route.query.mode
    || query.ayah !== route.query.ayah
  ) {
    router.replace({ params: { pageNumber: page }, query: query as Record<string, string> });
  }
}

let idleHandle: number | undefined;

onMounted(() => {
  const pageNum = Math.min(Math.max(parseInt(route.params.pageNumber as string) || 1, 1), mushafStore.totalPages);
  mushafStore.spreadMode = isSpread.value;
  mushafStore.loadWindow(pageNum);
  syncUrl();
  readerSettings.fetchTranslationSources();
  if (quranStore.surahs.length === 0) quranStore.fetchSurahs();

  const warmBook = () => {
    bookWarm.value = true;
  };
  idleHandle = typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(warmBook, { timeout: 4000 })
    : setTimeout(warmBook, 2000) as unknown as number;

  resetUiTimer();
  window.addEventListener("mousemove", resetUiTimer);
  window.addEventListener("touchstart", resetUiTimer);
  window.addEventListener("scroll", resetUiTimer);
  window.addEventListener("click", resetUiTimer);
});

onUnmounted(() => {
  clearTimeout(uiTimer);
  if (idleHandle !== undefined) {
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
    else clearTimeout(idleHandle);
  }
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

// Update URL when page, verse or mode changes via keyboard/click
watch([currentPage, position, requestedMode], syncUrl);

watch(isPane, closeSheet);

watch(isSpread, (spread) => {
  closeSheet();
  mushafStore.spreadMode = spread;
  mushafStore.loadWindow(currentPage.value);
});

const seoTitle = computed(() => `หน้า ${currentPage.value} - ${mode.value === "book" ? "สองภาษา" : "มุศฮัฟ"} - อัลกุรอานแปลไทย`);

useSeoMeta({
  title: seoTitle,
  ogTitle: seoTitle,
  description: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  ogDescription: computed(() => `อ่านอัลกุรอานหน้ามุศฮัฟ ${currentPage.value}`),
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div class="flex h-screen min-h-screen flex-col overflow-hidden bg-paper-surround">
    <ReadingReaderHeader
      :mode="mode"
      :translation-on="translationOn"
      :show-translation-toggle="mode === 'mushaf'"
      :range-label="rangeLabel"
      :has-prev="hasPrev"
      :has-next="hasNext"
      back-to="/"
      @update:mode="setMode"
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
      :pane="isPane"
      :pane-translation="paneTranslation"
      :layer-hidden="mode === 'book'"
      :nav-locked="mode === 'book' || sheetOpen || modalOpen"
      @open-translation="openSheet"
    >
      <template #sheet>
        <BookSpread
          v-if="bookWarm && position && bookSurah"
          ref="bookRef"
          class="transition-[opacity,visibility] duration-300 ease-out motion-reduce:transition-none"
          :class="mode === 'book' ? '' : 'invisible opacity-0'"
          :inert="mode !== 'book' || undefined"
          :surah-number="position.surah"
          :source-id="selectedSourceId && selectedSourceId > 0 ? selectedSourceId : undefined"
          :anchor-verse="position.verse"
          :surah="bookSurah"
          :active="mode === 'book'"
          :nav-locked="modalOpen"
          @position="handleBookPosition"
          @cross="handleBookCross"
        />
      </template>
    </MushafReader>

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
