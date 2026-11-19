<script setup lang="ts">
/**
 * BookSpread — the bilingual book layer of the Mushaf page's spread sheet.
 * It paginates one surah into facing pages; the page owns the URL, the header
 * and crossing into the next or previous surah.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { paginateBook, type BookItem, type BookPage } from "~/composables/bookPagination";
import { flipPage } from "~/composables/usePageFlip";
import { BOOK_FONT_LOADED_KEY, useBookVerses } from "~/composables/useBookVerses";
import { useQcfFont } from "~/composables/useQcfFont";
import { useQuranFont } from "~/composables/useQuranFont";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { storeToRefs } from "pinia";

export interface BookSurahMeta {
  nameArabic: string;
  nameThai: string;
  revelationPlace: string;
  versesCount: number;
}

export interface BookPosition {
  surah: number;
  firstVerse: number;
  lastVerse: number;
  /** Mushaf page of the first verse on the spread */
  page: number;
  atStart: boolean;
  atEnd: boolean;
}

const props = defineProps<{
  surahNumber: number;
  sourceId?: number;
  /** The spread holding this verse is shown; it moves whenever the page moves it */
  anchorVerse: number;
  surah: BookSurahMeta;
  /** The visible layer is the only one that takes keyboard and swipe turns */
  active: boolean;
  navLocked: boolean;
}>();

const emit = defineEmits<{
  position: [position: BookPosition];
  cross: [direction: "next" | "prev"];
}>();

// Padding, the 1px rule and the space under it, as BookPageView lays them out
const FOOTNOTE_AREA_GAP = 16;
const FOOTNOTE_GAP = 5;
const SWIPE_MIN_PX = 50;

const surahRef = computed(() => props.surahNumber);
const sourceRef = computed(() => props.sourceId);
const { verses, error, ensureLoaded, reset } = useBookVerses(surahRef, sourceRef);

const versesByKey = computed(() => new Map(verses.value.map(v => [v.key, v])));
const loaded = ref(false);

// The book follows the reader's chosen font; only the Mushaf layer is locked
const { quranFont, isQcf, fontVersion } = useQuranFont();
const { fontScale } = storeToRefs(useFontSettingsStore());
// Same curve as the verse reader; every font in the book scales off this one factor
const bookScale = computed(() => 1 + (fontScale.value - 3) * 0.12);
const bookWords = computed(() => (isQcf.value ? verses.value.flatMap(v => v.words) : []));
const { isFontLoaded, isFontSettled } = useQcfFont(bookWords, fontVersion);
provide(BOOK_FONT_LOADED_KEY, isFontLoaded);
const bookFontPages = computed(() => [...new Set(bookWords.value.map(w => w.page_number))]);
// Rows measured before their page fonts arrive would paginate at the wrong heights
const fontsSettled = computed(() => bookFontPages.value.every(isFontSettled));

const ready = computed(() => loaded.value && verses.value.length > 0 && fontsSettled.value);

const surahMeta = computed(() => ({ surahNumber: props.surahNumber, ...props.surah }));

const sheetEl = ref<HTMLElement | null>(null);
const measureEl = ref<HTMLElement | null>(null);
const bodySize = ref({ width: 0, height: 0 });
const pages = ref<BookPage[]>([]);
const spreadIndex = ref(0);
const expandedFootnote = ref<string | null>(null);

// The first verse on the right page is what survives a re-pagination
const anchor = ref(props.anchorVerse);
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
  anchor.value = verseNumbersOf(pages.value[index * 2])[0] ?? 1;
}

function next() {
  if (!ready.value) return;
  if (spreadIndex.value + 1 < spreadCount.value) flipPage("next", () => goToSpread(spreadIndex.value + 1));
  else emit("cross", "next");
}

function prev() {
  if (!ready.value) return;
  if (spreadIndex.value > 0) flipPage("prev", () => goToSpread(spreadIndex.value - 1));
  else emit("cross", "prev");
}

defineExpose({ next, prev });

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
  spreadIndex.value = Math.min(spreadForVerse(anchor.value), Math.max(spreadCount.value - 1, 0));
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
    await ensureLoaded(1, props.surah.versesCount);
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

// A size change, a text font, or glyphs already loaded swap in without a font load event to repaginate on
watch([quranFont, fontScale], async () => {
  await nextTick();
  schedulePaginate();
});

watch(() => [props.surahNumber, props.anchorVerse] as const, ([surah, verse], [prevSurah]) => {
  // The page echoes back the spread's first verse; adopting it would walk the anchor back on every re-pagination
  if (surah === prevSurah && spreadVerses.value.includes(verse)) return;
  anchor.value = verse;
  if (pages.value.length > 0) spreadIndex.value = spreadForVerse(verse);
});

watch(spreadIndex, () => {
  expandedFootnote.value = null;
});

watch(spreadVerses, (list) => {
  if (!ready.value || pages.value.length === 0 || list.length === 0) return;
  const firstVerse = list[0]!;
  emit("position", {
    surah: props.surahNumber,
    firstVerse,
    lastVerse: list[list.length - 1]!,
    page: versesByKey.value.get(`${props.surahNumber}:${firstVerse}`)?.pageNumber ?? 0,
    atStart: spreadIndex.value === 0,
    atEnd: spreadIndex.value + 1 >= spreadCount.value,
  });
});

function toggleFootnote(key: string) {
  expandedFootnote.value = expandedFootnote.value === key ? null : key;
}

function canTurn() {
  return props.active && !props.navLocked;
}

// Mushaf convention: the book is right-to-left, so "next" is leftwards
function handleKeydown(e: KeyboardEvent) {
  if (!canTurn() || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    next();
  }
  else if (e.key === "ArrowRight") {
    e.preventDefault();
    prev();
  }
}

let touchStart: { x: number; y: number } | null = null;

function handleTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  touchStart = t ? { x: t.clientX, y: t.clientY } : null;
}

function handleTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0];
  if (!touchStart || !t || !canTurn()) return;
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx > 0) next();
  else prev();
}

let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  document.fonts.addEventListener("loadingdone", schedulePaginate);

  const body = sheetEl.value?.querySelector<HTMLElement>("[data-page-body]");
  if (body) {
    resizeObserver = new ResizeObserver(schedulePaginate);
    resizeObserver.observe(body);
  }
  load();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  document.fonts.removeEventListener("loadingdone", schedulePaginate);
  resizeObserver?.disconnect();
  if (paginateFrame) cancelAnimationFrame(paginateFrame);
});
</script>

<template>
  <div
    ref="sheetEl"
    class="absolute inset-0 flex"
    :style="{ '--book-scale': bookScale }"
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
    <div aria-hidden="true" class="w-7 shrink-0" />
    <BookPageView
      :page="rightPage"
      side="right"
      :verses-by-key="versesByKey"
      :surah="surahMeta"
      :expanded-footnote="expandedFootnote"
      @toggle-footnote="toggleFootnote"
    />

    <div v-if="!ready && error" class="absolute inset-0 z-10 flex items-center justify-center bg-paper">
      <ErrorState @retry="reload" />
    </div>
    <div v-else-if="!ready" class="absolute inset-0 flex bg-paper">
      <div class="flex flex-1 items-center justify-center">
        <InkSpinner class="text-ink" />
      </div>
      <div aria-hidden="true" class="w-7 shrink-0" />
      <div class="flex flex-1 items-center justify-center">
        <InkSpinner class="text-ink" />
      </div>
    </div>

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
          <BookRow v-else :verse="item.verse" :verses-count="surah.versesCount" />
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
  </div>
</template>
