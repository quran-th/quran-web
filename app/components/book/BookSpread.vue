<script setup lang="ts">
/**
 * BookSpread — the bilingual book layer of the Mushaf page's spread sheet.
 * It paginates one surah into facing pages; the page owns the URL, the header
 * and crossing into the next or previous surah. A last spread that would leave
 * the left page blank shows the next surah's first page there instead.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { layoutBook, paginateBook, type BookItem, type BookPage } from "~/composables/bookPagination";
import { flipPage } from "~/composables/usePageFlip";
import { useSwipeTurn } from "~/composables/useSwipeTurn";
import { BOOK_FONT_LOADED_KEY, useBookVerses, type BookVerse } from "~/composables/useBookVerses";
import { useQcfFont } from "~/composables/useQcfFont";
import { SELECTED_VERSE_KEY } from "~/composables/selectedVerse";
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

export interface BookNeighbor extends BookSurahMeta {
  surahNumber: number;
}

/** Where the next surah opens when its first page was already read on the left */
export interface BookLanding {
  surahStep: 1 | 2;
  verse: number;
  leadingPages: 0 | 1;
}

const props = defineProps<{
  surahNumber: number;
  sourceId?: number;
  /** The spread holding this verse is shown; it moves whenever the page moves it */
  anchorVerse: number;
  /** A spread starts at this verse, so the book opens where the Mushaf page did */
  breakVerse?: number;
  surah: BookSurahMeta;
  nextSurah?: BookNeighbor | null;
  /** Pages already read on the previous surah's last spread; spreads start after them */
  leadingPages?: number;
  /** The visible layer is the only one that takes keyboard and swipe turns */
  active: boolean;
  navLocked: boolean;
}>();

const emit = defineEmits<{
  position: [position: BookPosition];
  cross: [direction: "next" | "prev", landing?: BookLanding];
}>();

// Padding, the 1px rule and the space under it, as BookPageView lays them out
const FOOTNOTE_AREA_GAP = 16;
const FOOTNOTE_GAP = 5;
// One by-keys chunk is plenty for a single page of the next surah
const NEIGHBOR_VERSES = 25;

const surahRef = computed(() => props.surahNumber);
const sourceRef = computed(() => props.sourceId);
const { verses, error, ensureLoaded, reset } = useBookVerses(surahRef, sourceRef);

const versesByKey = computed(() => new Map(verses.value.map(v => [v.key, v])));
const loaded = ref(false);

// Kept apart from the surah's own verses so position, anchor and URL only ever see this surah
const neighborNumber = computed(() => props.nextSurah?.surahNumber ?? 0);
const neighbor = useBookVerses(neighborNumber, sourceRef);
const neighborVersesByKey = computed(() => new Map(neighbor.verses.value.map(v => [v.key, v])));
const neighborLoaded = ref(false);
const neighborPage = ref<BookPage | null>(null);

// The book follows the reader's chosen font; only the Mushaf layer is locked
const { quranFont, isQcf, fontVersion } = useQuranFont();
// --book-scale and --book-width come from MushafReader's spread
const { fontScale } = storeToRefs(useFontSettingsStore());
const bookWords = computed(() => (isQcf.value ? [...verses.value, ...neighbor.verses.value].flatMap(v => v.words) : []));
const { isFontLoaded, isFontSettled } = useQcfFont(bookWords, fontVersion);
provide(BOOK_FONT_LOADED_KEY, isFontLoaded);
// The book sits inside the Mushaf reader; an ayah picked on the Mushaf page means nothing here
provide(SELECTED_VERSE_KEY, ref(null));
function fontPagesOf(list: BookVerse[]): number[] {
  return isQcf.value ? [...new Set(list.flatMap(v => v.words.map(w => w.page_number)))] : [];
}
// Rows measured before their page fonts arrive would paginate at the wrong heights
const fontsSettled = computed(() => fontPagesOf(verses.value).every(isFontSettled));
const neighborFontsSettled = computed(() => fontPagesOf(neighbor.verses.value).every(isFontSettled));

const ready = computed(() => loaded.value && verses.value.length > 0 && fontsSettled.value);
const neighborReady = computed(() => neighborLoaded.value && neighbor.verses.value.length > 0 && neighborFontsSettled.value);

const surahMeta = computed(() => ({ surahNumber: props.surahNumber, ...props.surah }));

const sheetEl = ref<HTMLElement | null>(null);
const measureEl = ref<HTMLElement | null>(null);
const neighborMeasureEl = ref<HTMLElement | null>(null);
const bodySize = ref({ width: 0, height: 0 });
const pages = ref<BookPage[]>([]);
// Kept so a new break only lays the pages out again, without measuring
const measured = ref<BookItem[]>([]);
const spreadIndex = ref(0);
const expandedFootnote = ref<string | null>(null);

// The first verse on the right page is what survives a re-pagination
const anchor = ref(props.anchorVerse);
let paginateToken = 0;

const lead = computed(() => Math.min(props.leadingPages ?? 0, Math.max(pages.value.length - 1, 0)));
const spreadCount = computed(() => Math.ceil((pages.value.length - lead.value) / 2));
const rightPage = computed(() => pages.value[lead.value + spreadIndex.value * 2]);
const leftPage = computed(() => pages.value[lead.value + spreadIndex.value * 2 + 1]);
const onLastSpread = computed(() => pages.value.length > 0 && spreadIndex.value + 1 >= spreadCount.value);
const endsOnRightPage = computed(() => (pages.value.length - lead.value) % 2 === 1);

// Fetched only as the reader nears the end, so long surahs don't pull their neighbor on every view
const neighborWanted = computed(() =>
  !!props.nextSurah && ready.value && endsOnRightPage.value && spreadIndex.value + 2 >= spreadCount.value,
);
const showNeighbor = computed(() => onLastSpread.value && !leftPage.value && !!neighborPage.value && neighborReady.value);
const neighborMeta = computed(() => props.nextSurah ?? null);

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
  return index === -1 ? 0 : Math.max(0, Math.floor((index - lead.value) / 2));
}

function goToSpread(index: number) {
  spreadIndex.value = index;
  anchor.value = verseNumbersOf(pages.value[lead.value + index * 2])[0] ?? 1;
}

function landingAfterNeighbor(): BookLanding | undefined {
  if (!showNeighbor.value || !props.nextSurah) return undefined;
  const shown = (neighborPage.value?.items ?? []).flatMap((key) => {
    const verse = neighborVersesByKey.value.get(key);
    return verse ? [verse.verseNumber] : [];
  });
  const last = shown.length ? Math.max(...shown) : 0;
  if (last === 0) return undefined;
  if (last >= props.nextSurah.versesCount) return { surahStep: 2, verse: 1, leadingPages: 0 };
  return { surahStep: 1, verse: last + 1, leadingPages: 1 };
}

function next() {
  if (!ready.value) return;
  if (spreadIndex.value + 1 < spreadCount.value) flipPage("next", () => goToSpread(spreadIndex.value + 1));
  else emit("cross", "next", landingAfterNeighbor());
}

function prev() {
  if (!ready.value) return;
  if (spreadIndex.value > 0) flipPage("prev", () => goToSpread(spreadIndex.value - 1));
  else emit("cross", "prev");
}

defineExpose({ next, prev });

function measure(container: HTMLElement): BookItem[] {
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
  return items;
}

function paginateItems(items: BookItem[]): BookPage[] {
  // Sub-pixel slack so a page that measures as full never clips its last line
  return paginateBook(items, {
    pageHeight: bodySize.value.height - 2,
    footnoteAreaGap: FOOTNOTE_AREA_GAP,
    footnoteGap: FOOTNOTE_GAP,
  });
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

  measured.value = measure(container);
  layout();
  paginateNeighbor();
}

function layout() {
  pages.value = layoutBook(measured.value, {
    pageHeight: bodySize.value.height - 2,
    footnoteAreaGap: FOOTNOTE_AREA_GAP,
    footnoteGap: FOOTNOTE_GAP,
    breakKey: props.breakVerse ? `${props.surahNumber}:${props.breakVerse}` : undefined,
    lead: props.leadingPages ?? 0,
  });
  spreadIndex.value = Math.min(spreadForVerse(anchor.value), Math.max(spreadCount.value - 1, 0));
}

let neighborToken = 0;

async function paginateNeighbor() {
  const token = ++neighborToken;
  if (!neighborReady.value || bodySize.value.height === 0) return;
  await nextTick();
  await document.fonts.ready;
  const container = neighborMeasureEl.value;
  if (token !== neighborToken || !container) return;
  neighborPage.value = paginateItems(measure(container))[0] ?? null;
}

let neighborLoadToken = 0;

async function loadNeighbor() {
  const token = ++neighborLoadToken;
  try {
    await neighbor.ensureLoaded(1, NEIGHBOR_VERSES);
    if (token === neighborLoadToken) neighborLoaded.value = true;
  }
  catch (e) {
    console.error("Failed to load next surah for the book:", e);
  }
}

function resetNeighbor() {
  neighborLoadToken++;
  neighborToken++;
  neighborLoaded.value = false;
  neighborPage.value = null;
  neighbor.reset();
  if (neighborWanted.value) loadNeighbor();
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
  measured.value = [];
  spreadIndex.value = 0;
  reset();
  load();
}

watch(() => [props.surahNumber, props.sourceId], reload);
watch(() => [neighborNumber.value, props.sourceId], resetNeighbor);
watch(neighborWanted, (wanted) => {
  if (wanted && !neighborLoaded.value) loadNeighbor();
});
watch(neighborReady, (isReady) => {
  if (isReady) paginateNeighbor();
});
// The break's spread parity counts from the lead, so a new lead lays the pages out again
watch(() => props.leadingPages, () => {
  if (measured.value.length > 0) layout();
});
watch(ready, (isReady) => {
  if (isReady) schedulePaginate();
});

// A size change, a text font, or glyphs already loaded swap in without a font load event to repaginate on
watch([quranFont, fontScale], async () => {
  await nextTick();
  schedulePaginate();
});

watch(() => [props.surahNumber, props.anchorVerse, props.breakVerse] as const, ([surah, verse, breakVerse], [prevSurah, , prevBreak]) => {
  if (surah === prevSurah && breakVerse !== prevBreak && measured.value.length > 0) {
    anchor.value = verse;
    layout();
    return;
  }
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

const swipe = useSwipeTurn({
  enabled: () => canTurn() && ready.value,
  canTurn: () => true,
  layers: () => (sheetEl.value ? [sheetEl.value] : []),
  turn: direction => (direction === "next" ? next() : prev()),
});

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
    class="absolute inset-0 mx-auto flex"
    :style="{ width: 'var(--book-width, 100%)' }"
    @touchstart.passive="swipe.onTouchStart"
  >
    <BookPageView
      v-if="showNeighbor && neighborMeta"
      :page="neighborPage ?? undefined"
      side="left"
      :verses-by-key="neighborVersesByKey"
      :surah="neighborMeta"
      :expanded-footnote="expandedFootnote"
      @toggle-footnote="toggleFootnote"
    />
    <BookPageView
      v-else
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

    <div
      v-if="neighborReady && neighborMeta && bodySize.width > 0"
      ref="neighborMeasureEl"
      aria-hidden="true"
      class="pointer-events-none invisible absolute left-0 top-0"
      :style="{ width: `${bodySize.width}px` }"
    >
      <div data-measure-key="header">
        <div data-measure-row>
          <BookSurahHeader v-bind="neighborMeta" />
        </div>
      </div>
      <div v-for="verse in neighbor.verses.value" :key="verse.key" :data-measure-key="verse.key">
        <div data-measure-row>
          <BookRow :verse="verse" :verses-count="neighborMeta.versesCount" />
        </div>
        <BookFootnote
          v-for="f in verse.footnotes"
          :key="f.number"
          data-measure-footnote
          :number="99"
          :text="f.text"
        />
      </div>
    </div>
  </div>
</template>
