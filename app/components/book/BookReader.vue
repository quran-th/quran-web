<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { paginateBook, type BookItem, type BookPage } from "~/composables/bookPagination";
import { flipPage } from "~/composables/usePageFlip";
import { useBookVerses } from "~/composables/useBookVerses";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useRecitationStore } from "~/stores/recitationStore";
import type { Verse } from "~/stores/quranStore";
import ReportModal from "~/components/reading/ReportModal.vue";

const props = defineProps<{
  surahNumber: number;
  sourceId?: number;
  initialAyah: number;
  nameArabic: string;
  nameThai: string;
  revelationPlace: string;
  versesCount: number;
  prevSurahVersesCount?: number;
}>();

const FOOTNOTE_AREA_GAP = 8;
const FOOTNOTE_GAP = 5;
const SWIPE_MIN_PX = 50;

const router = useRouter();
const route = useRoute();
const recitation = useRecitationStore();
const readerSettings = useReaderSettingsStore();

const surahRef = computed(() => props.surahNumber);
const sourceRef = computed(() => props.sourceId);
const { verses, error, ensureLoaded, reset } = useBookVerses(surahRef, sourceRef);

const versesByKey = computed(() => new Map(verses.value.map(v => [v.key, v])));
const loaded = ref(false);
const ready = computed(() => loaded.value && verses.value.length > 0);

const surahMeta = computed(() => ({
  surahNumber: props.surahNumber,
  nameArabic: props.nameArabic,
  nameThai: props.nameThai,
  revelationPlace: props.revelationPlace,
  versesCount: props.versesCount,
}));

const sheetEl = ref<HTMLElement | null>(null);
const measureEl = ref<HTMLElement | null>(null);
const bodySize = ref({ width: 0, height: 0 });
const pages = ref<BookPage[]>([]);
const spreadIndex = ref(0);
const expandedFootnote = ref<string | null>(null);
const showSettings = ref(false);
const showReport = ref(false);
const reportVerse = ref<Verse | null>(null);

// The first verse on the right page is what survives a re-pagination
const anchorVerse = ref(props.initialAyah);
let paginateToken = 0;

const spreadCount = computed(() => Math.ceil(pages.value.length / 2));
const rightPage = computed(() => pages.value[spreadIndex.value * 2]);
const leftPage = computed(() => pages.value[spreadIndex.value * 2 + 1]);

function verseNumbersOf(page: BookPage | undefined): number[] {
  return (page?.items ?? []).flatMap((key) => {
    const verse = versesByKey.value.get(key);
    return verse ? [verse.verseNumber] : [];
  });
}

const spreadVerses = computed(() => [...verseNumbersOf(rightPage.value), ...verseNumbersOf(leftPage.value)]);
const firstVerse = computed(() => spreadVerses.value[0] ?? anchorVerse.value);

const rangeLabel = computed(() => {
  const list = spreadVerses.value;
  if (list.length === 0) return undefined;
  const first = list[0]!;
  const last = list[list.length - 1]!;
  return first === last ? `อายะห์ ${first}` : `อายะห์ ${first}–${last}`;
});

const headerLinks = computed(() => {
  const mushafPage = versesByKey.value.get(`${props.surahNumber}:${firstVerse.value}`)?.pageNumber;
  return {
    ayah: `/${props.surahNumber}/${firstVerse.value}`,
    mushaf: mushafPage ? `/page/${mushafPage}` : undefined,
    book: `/${props.surahNumber}/${firstVerse.value}?mode=book`,
  };
});

const hasPrev = computed(() => spreadIndex.value > 0 || props.surahNumber > 1);
const hasNext = computed(() => spreadIndex.value + 1 < spreadCount.value || props.surahNumber < 114);

const measureItems = computed(() => [
  { key: "header", verse: undefined },
  ...verses.value.map(verse => ({ key: verse.key, verse })),
]);

function spreadForVerse(verseNumber: number): number {
  if (verseNumber <= 1) return 0;
  const key = `${props.surahNumber}:${verseNumber}`;
  const index = pages.value.findIndex(page => page.items.includes(key));
  return index === -1 ? 0 : Math.floor(index / 2);
}

function goToSpread(index: number) {
  spreadIndex.value = index;
  anchorVerse.value = verseNumbersOf(pages.value[index * 2])[0] ?? 1;
}

function goNext() {
  if (spreadIndex.value + 1 < spreadCount.value) flipPage("next", () => goToSpread(spreadIndex.value + 1));
  else if (props.surahNumber < 114) router.push({ path: `/${props.surahNumber + 1}/1`, query: { ...route.query, mode: "book" } });
}

function goPrev() {
  if (spreadIndex.value > 0) flipPage("prev", () => goToSpread(spreadIndex.value - 1));
  else if (props.surahNumber > 1) {
    const lastVerse = props.prevSurahVersesCount ?? 1;
    router.push({ path: `/${props.surahNumber - 1}/${lastVerse}`, query: { ...route.query, mode: "book" } });
  }
}

async function paginate() {
  const token = ++paginateToken;
  if (!ready.value) return;
  const body = sheetEl.value?.querySelector<HTMLElement>("[data-page-body]");
  if (!body || body.clientWidth === 0 || body.clientHeight === 0) return;
  bodySize.value = { width: body.clientWidth, height: body.clientHeight };
  await nextTick();
  await document.fonts.ready;
  const container = measureEl.value;
  if (token !== paginateToken || !container) return;

  const items: BookItem[] = [];
  for (const node of container.querySelectorAll<HTMLElement>("[data-measure-key]")) {
    const key = node.dataset.measureKey!;
    const row = node.querySelector<HTMLElement>("[data-measure-row]")!;
    const footnoteHeights = [...node.querySelectorAll<HTMLElement>("[data-measure-footnote]")]
      .map(el => Math.ceil(el.getBoundingClientRect().height));
    items.push({
      key,
      kind: key === "header" ? "header" : "verse",
      rowHeight: Math.ceil(row.getBoundingClientRect().height),
      footnoteHeights,
    });
  }

  // Sub-pixel slack so a page that measures as full never clips its last line
  pages.value = paginateBook(items, {
    pageHeight: bodySize.value.height - 2,
    footnoteAreaGap: FOOTNOTE_AREA_GAP,
    footnoteGap: FOOTNOTE_GAP,
  });
  spreadIndex.value = Math.min(spreadForVerse(anchorVerse.value), Math.max(spreadCount.value - 1, 0));
}

let paginateFrame = 0;
function schedulePaginate() {
  if (paginateFrame) cancelAnimationFrame(paginateFrame);
  paginateFrame = requestAnimationFrame(() => {
    paginateFrame = 0;
    paginate();
  });
}

let loadToken = 0;

async function load() {
  const token = ++loadToken;
  try {
    await ensureLoaded(1, props.versesCount);
    if (token === loadToken) loaded.value = true;
  }
  catch (e) {
    console.error("Failed to load book verses:", e);
  }
}

// The only place that resets and reloads, so the order never depends on watcher registration
function reload() {
  loadToken++;
  loaded.value = false;
  pages.value = [];
  spreadIndex.value = 0;
  reset();
  load();
}

watch(() => [props.surahNumber, props.sourceId], reload);
watch(ready, (isReady) => {
  if (isReady) schedulePaginate();
});

watch(spreadIndex, () => {
  expandedFootnote.value = null;
});

watch([firstVerse, pages], ([verse, paginated]) => {
  if (!ready.value || paginated.length === 0 || String(route.params.ayah) === String(verse)) return;
  router.replace({
    path: `/${props.surahNumber}/${verse}`,
    query: { ...route.query, mode: "book" },
  });
});

// Prefetch: iOS only allows audio playback started from a user gesture
watch(
  () => props.surahNumber,
  (surah) => {
    recitation.loadTimings(surah);
    recitation.loadTranslation(surah);
  },
  { immediate: true },
);

function handleListen() {
  recitation.playVerse(props.surahNumber, firstVerse.value);
}

async function handleReport() {
  const key = `${props.surahNumber}:${firstVerse.value}`;
  try {
    const res = await $fetch<{ success: boolean; data: { verses: Verse[] } }>("/api/verses/by-keys", {
      method: "POST",
      body: { keys: [key], sourceId: props.sourceId },
    });
    const verse = res.success ? res.data.verses[0] : undefined;
    if (!verse) return;
    reportVerse.value = verse;
    showReport.value = true;
  }
  catch (e) {
    console.error("Failed to load verse for report:", e);
  }
}

function toggleFootnote(key: string) {
  expandedFootnote.value = expandedFootnote.value === key ? null : key;
}

// Mushaf convention: the book is right-to-left, so "next" is leftwards
function handleKeydown(e: KeyboardEvent) {
  if (showSettings.value || showReport.value || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
  if (e.key === "ArrowLeft") goNext();
  else if (e.key === "ArrowRight") goPrev();
}

let touchStart: { x: number; y: number } | null = null;

function handleTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  touchStart = t ? { x: t.clientX, y: t.clientY } : null;
}

function handleTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0];
  if (!touchStart || !t) return;
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx > 0) goNext();
  else goPrev();
}

let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", handleKeydown);
  document.fonts.addEventListener("loadingdone", schedulePaginate);
  readerSettings.fetchTranslationSources();

  const body = sheetEl.value?.querySelector<HTMLElement>("[data-page-body]");
  if (body) {
    resizeObserver = new ResizeObserver(schedulePaginate);
    resizeObserver.observe(body);
  }
  load();
});

onBeforeUnmount(() => {
  document.body.style.overflow = "";
  window.removeEventListener("keydown", handleKeydown);
  document.fonts.removeEventListener("loadingdone", schedulePaginate);
  resizeObserver?.disconnect();
  if (paginateFrame) cancelAnimationFrame(paginateFrame);
});
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper-surround">
    <ReadingReaderHeader
      mode="book"
      :links="headerLinks"
      :translation-on="true"
      :show-translation-toggle="false"
      :range-label="rangeLabel"
      :has-prev="hasPrev"
      :has-next="hasNext"
      back-to="/"
      @prev="goPrev"
      @next="goNext"
      @listen="handleListen"
      @report="handleReport"
      @settings="showSettings = true"
    />

    <main class="relative flex min-h-0 flex-1 px-6 pt-4 pb-10">
      <div
        ref="sheetEl"
        class="paper-surface book-sheet relative flex flex-1 overflow-hidden [view-transition-name:book-spread]"
        @touchstart.passive="handleTouchStart"
        @touchend.passive="handleTouchEnd"
      >
        <BookPageView
          :page="leftPage"
          side="left"
          :verses-by-key="versesByKey"
          :surah="surahMeta"
          :expanded-footnote="expandedFootnote"
          @toggle-footnote="toggleFootnote"
        />
        <div
          aria-hidden="true"
          class="book-spine w-7 shrink-0"
        />
        <BookPageView
          :page="rightPage"
          side="right"
          :verses-by-key="versesByKey"
          :surah="surahMeta"
          :expanded-footnote="expandedFootnote"
          @toggle-footnote="toggleFootnote"
        />

        <div
          v-if="!ready"
          class="absolute inset-0 flex text-sm text-ink-muted"
          :class="error ? 'text-red-600' : ''"
        >
          <div class="flex flex-1 items-center justify-center">
            <InkSpinner v-if="!error" class="text-ink" />
          </div>
          <div aria-hidden="true" class="w-7 shrink-0" />
          <div class="flex flex-1 flex-col items-center justify-center gap-3">
            <p v-if="error" class="m-0">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</p>
            <InkSpinner v-else class="text-ink" />
            <button
              v-if="error"
              type="button"
              class="h-10 rounded-xl px-3 text-sm text-ink hover:bg-paper-tint"
              @click="reload"
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      </div>
      <div aria-hidden="true" class="book-spine-foot absolute bottom-[31px] left-1/2 h-[9px] w-7 -translate-x-1/2" />
    </main>

    <div
      v-if="ready && bodySize.width > 0"
      ref="measureEl"
      aria-hidden="true"
      class="pointer-events-none invisible absolute left-0 top-0"
      :style="{ width: `${bodySize.width}px` }"
    >
      <div v-for="item in measureItems" :key="item.key" :data-measure-key="item.key">
        <div data-measure-row>
          <BookSurahHeader v-if="!item.verse" v-bind="surahMeta" />
          <BookRow v-else :verse="item.verse" />
        </div>
        <BookFootnote
          v-for="f in item.verse?.footnotes ?? []"
          :key="f.number"
          data-measure-footnote
          :number="99"
          :text="f.text"
        />
      </div>
    </div>

    <SettingsReaderSettingsModal v-model:visible="showSettings" />
    <ReportModal
      v-if="reportVerse"
      v-model:visible="showReport"
      :verse="reportVerse"
      :surah-number="surahNumber"
      :source-id="sourceId"
    />
    <ClientOnly>
      <ReadingRecitationPlayerBar />
    </ClientOnly>
  </div>
</template>
