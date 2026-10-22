<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick, resolveComponent } from "vue";
import { useQuranStore } from "~/stores/quranStore";
import type { Verse, Pagination } from "~/stores/quranStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useRecitationStore } from "~/stores/recitationStore";
import { useQcfFont } from "~/composables/useQcfFont";
import { isKnownReciter } from "~/data/reciter-names-th";
// TODO: re-enable when QuranToolbar is unhidden
// import QuranToolbar from "~/components/reading/QuranToolbar.vue";

// Clean share URLs: /2 and /2/255. Keyed by surah only so the scroll-driven
// /2/N address updates don't remount the page (and stop recitation).
definePageMeta({
  path: "/:id(\\d+)/:ayah(\\d+)?",
  key: (route) => String(route.params.id),
  // Same surah, different /N (scroll sync, in-page links) must keep position
  scrollToTop: (to, from) => to.params.id !== from.params.id,
});

interface MushafPage {
  page: number;
  verseFrom: number;
  verseTo: number;
  verseCount: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface SurahData {
  id: number;
  name_simple: string;
  name_arabic: string;
  name_thai: string;
  name_meaning_thai: string;
  revelation_place: string;
  verses_count: number;
  verses: Verse[];
  pagination: Pagination;
  sourceId: number;
}

const route = useRoute();
const router = useRouter();
const quranStore = useQuranStore();
const fontSettings = useFontSettingsStore();
const readerSettings = useReaderSettingsStore();
const recitation = useRecitationStore();
const NuxtLink = resolveComponent("NuxtLink");
const {
  currentSurah,
  verses,
  pagination,
  error,
  allWords,
  currentSourceId,
} = storeToRefs(quranStore);
const { fontVersion } = storeToRefs(fontSettings);
const { selectedSourceId, translationSources } = storeToRefs(readerSettings);
const { activeVerseKey, status: recitationStatus, chapter: recitationChapter } = storeToRefs(recitation);

const isExternalSource = computed(() => {
  const src = translationSources.value.find((s) => s.id === currentSourceId.value);
  return src?.isExternal ?? false;
});

const currentSourceName = computed(() => {
  const src = translationSources.value.find((s) => s.id === currentSourceId.value);
  return src?.name ?? "";
});

// Initialize QCF font loading
const { isFontLoaded } = useQcfFont(allWords, fontVersion);

// Parse route: /:id/:ayah? plus ?translation=&reciter=&play
const surahId = parseInt(route.params.id as string);
const ayahParam = route.params.ayah ? parseInt(route.params.ayah as string) : null;
const sourceParam = parseInt(route.query.translation as string) || null;

if (surahId < 1 || surahId > 114 || (ayahParam !== null && ayahParam < 1)) {
  throw createError({ statusCode: 404, statusMessage: "Surah not found", fatal: true });
}

// If a translation source was specified in the URL, apply it and persist to cookie
if (sourceParam && sourceParam > 0) {
  readerSettings.setTranslationSource(sourceParam);
}

// SSR-time source used for the initial useAsyncData call. Subsequent
// client-side fetches use `effectiveSourceId` below so the latest
// selection (or source resolved by the API) is always sent.
const validSourceId =
  sourceParam ||
  (selectedSourceId.value && selectedSourceId.value > 0
    ? selectedSourceId.value
    : undefined);

// Always send an explicit sourceId on client nav so response URLs are
// uniquely keyed by source (avoids browser cache collisions across
// sources). Prefers the user selection, falls back to whatever the
// last API response resolved as the active source.
const effectiveSourceId = computed(
  () =>
    (selectedSourceId.value && selectedSourceId.value > 0
      ? selectedSourceId.value
      : undefined) ?? currentSourceId.value,
);

// Fetch Mushaf page mapping for current surah
const apiFetch = useQuranApiFetch();
const { data: mushafPagesData } = await useAsyncData(
  `surah-${surahId}-mushaf-pages`,
  () => apiFetch<ApiResponse<MushafPage[]>>(`/surahs/${surahId}/mushaf-pages`),
);

// Fetch global surah page mapping for seamless cross-surah navigation
const { data: globalPageMapping } = await useAsyncData<
  Record<string, MushafPage[]>
>(`global-surah-page-mapping`, () =>
  $fetch(
    `${useRuntimeConfig().public.assetsBaseUrl}/quran-pages/surah-page-mapping.json`,
  ),
);

// Fetch all surahs for global name resolution
const { data: allSurahsData } = await useAsyncData("all-surahs", () =>
  apiFetch<ApiResponse<Surah[]>>("/surahs"),
);
const allSurahs = computed(
  () => allSurahsData.value?.data || quranStore.surahs,
);

const firstPageNumber = mushafPagesData.value?.data?.[0]?.page ?? 1;
const currentPage = ref<number>(firstPageNumber);

// Resolve page from ayah param by finding the Mushaf page containing that verse
function resolvePageForAyah(ayah: number, pages: MushafPage[]): number | null {
  for (const p of pages) {
    if (ayah >= p.verseFrom && ayah <= p.verseTo) return p.page;
  }
  return null;
}

if (ayahParam && mushafPagesData.value?.data?.length) {
  const resolved = resolvePageForAyah(ayahParam, mushafPagesData.value.data);
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: "Ayah not found", fatal: true });
  }
  currentPage.value = resolved;
}

// Get current page info - use mushafPagesData directly for SSR compatibility
const currentPageInfo = computed(() => {
  const pages = mushafPagesData.value?.data;
  if (!pages || !pages.length) return null;
  return pages.find((p) => p.page === currentPage.value) || pages[0];
});

// SSR: Fetch verses for current Mushaf page
const pageInfo = currentPageInfo.value;
const offset = pageInfo ? pageInfo.verseFrom - 1 : 0;
const limit = pageInfo ? pageInfo.verseTo - pageInfo.verseFrom + 1 : 50;

const { data: ssrData, status: fetchStatus } = await useAsyncData(
  `surah-${surahId}-page-${currentPage.value}-source-${validSourceId ?? 'default'}`,
  () => {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });
    if (validSourceId) {
      params.set("sourceId", validSourceId.toString());
    }
    return apiFetch<ApiResponse<SurahData>>(
      `/surahs/${surahId}?${params.toString()}`,
    );
  },
);

// Don't let ISR cache an API outage as a 200 error page
if (import.meta.server && (!ssrData.value?.success || !mushafPagesData.value?.data?.length)) {
  throw createError({ statusCode: 503, statusMessage: "Service unavailable", fatal: true });
}

// Hydrate store and pages
if (ssrData.value && ssrData.value.success) {
  const data = ssrData.value.data;
  currentSurah.value = {
    id: data.id,
    name_simple: data.name_simple,
    name_arabic: data.name_arabic,
    name_thai: data.name_thai,
    name_meaning_thai: data.name_meaning_thai,
    englishName: data.name_simple,
    englishNameTranslation: data.name_thai,
    revelation_place: data.revelation_place,
    verses_count: data.verses_count,
  };
  verses.value = data.verses;
  pagination.value = data.pagination;
  currentSourceId.value = data.sourceId;
}

function scrollToSurahHeader() {
  nextTick(() => {
    const el = document.getElementById("surah-header");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: "smooth" });
  });
}

const showSurahModal = ref(false);

// Canonical URL of a Mushaf page within a surah: /2 for the surah's first
// page, otherwise /2/{first ayah on the page} (e.g. page 42 → /2/253)
function surahPagePath(sId: number, page: MushafPage): string {
  return page.verseFrom === 1 ? `/${sId}` : `/${sId}/${page.verseFrom}`;
}

// ─── Infinite scroll ─────────────────────────────────────────────────────────
// Verses load one Mushaf page at a time so request URLs (offset/limit) match the
// server-rendered /N/{first ayah} pages — shared cache keys across readers. Each
// page stays a crawlable SSR URL; the load triggers are real <a href> links.

const mushafPageList = computed(() => mushafPagesData.value?.data ?? []);
const initialPageIndex = Math.max(
  0,
  mushafPageList.value.findIndex((p) => p.page === currentPage.value),
);
const firstLoadedIndex = ref(initialPageIndex);
const lastLoadedIndex = ref(initialPageIndex);
const isLoadingNext = ref(false);
const isLoadingPrev = ref(false);

const prevUnloadedPage = computed(
  () => mushafPageList.value[firstLoadedIndex.value - 1] ?? null,
);
const nextUnloadedPage = computed(
  () => mushafPageList.value[lastLoadedIndex.value + 1] ?? null,
);
const lastLoadedPage = computed(
  () => mushafPageList.value[lastLoadedIndex.value] ?? null,
);

const loadedPageGroups = computed(() => {
  const pages = mushafPageList.value.slice(
    firstLoadedIndex.value,
    lastLoadedIndex.value + 1,
  );
  if (!pages.length) return [{ page: null, verses: verses.value }];
  return pages.map((page) => ({
    page,
    verses: verses.value.filter(
      (v) => v.verseNumber >= page.verseFrom && v.verseNumber <= page.verseTo,
    ),
  }));
});

const nextSurah = computed(() =>
  allSurahs.value.find((s) => s.id === surahId + 1) ?? null,
);

// Async loads write the shared verse list; any result whose generation is
// stale (source switched, jumped to another page, or the page is being left
// for another surah) is dropped instead of written
let loadGeneration = 0;
let isTornDown = false;
// Generation of the in-flight translation reload, if any (a superseded reload must not leave load-more blocked)
let reloadingGeneration: number | null = null;

function isCurrent(generation: number) {
  return generation === loadGeneration && !isTornDown;
}

async function fetchPageVerses(
  page: MushafPage,
): Promise<{ verses: Verse[]; sourceId: number } | null> {
  const params = new URLSearchParams({
    offset: String(page.verseFrom - 1),
    limit: String(page.verseTo - page.verseFrom + 1),
  });
  if (effectiveSourceId.value) {
    params.set("sourceId", String(effectiveSourceId.value));
  }
  try {
    const res = await apiFetch<ApiResponse<SurahData>>(
      `/surahs/${surahId}?${params.toString()}`,
    );
    if (!res.success) return null;
    return { verses: res.data.verses, sourceId: res.data.sourceId };
  } catch (e) {
    console.error("Failed to load verses:", e);
    return null;
  }
}

async function loadNextPage(): Promise<boolean> {
  const page = nextUnloadedPage.value;
  if (!page || isLoadingNext.value || reloadingGeneration === loadGeneration || isTornDown) return false;
  const generation = loadGeneration;
  isLoadingNext.value = true;
  const result = await fetchPageVerses(page);
  isLoadingNext.value = false;
  if (!result || !isCurrent(generation) || nextUnloadedPage.value !== page) return false;
  currentSourceId.value = result.sourceId;
  verses.value = [...verses.value, ...result.verses];
  lastLoadedIndex.value += 1;
  await nextTick();
  loadMoreIfSentinelVisible();
  return true;
}

async function loadPrevPage() {
  const page = prevUnloadedPage.value;
  if (!page || isLoadingPrev.value || reloadingGeneration === loadGeneration || isTornDown) return;
  const generation = loadGeneration;
  isLoadingPrev.value = true;
  const result = await fetchPageVerses(page);
  isLoadingPrev.value = false;
  if (!result || !isCurrent(generation) || prevUnloadedPage.value !== page) return;
  currentSourceId.value = result.sourceId;

  const anchor = document.getElementById(`ayah-${verses.value[0]?.verseNumber}`);
  const anchorTop = anchor?.getBoundingClientRect().top ?? 0;
  verses.value = [...result.verses, ...verses.value];
  firstLoadedIndex.value -= 1;
  await nextTick();
  // Keep the reader in place; a no-op where the browser's scroll anchoring
  // already did it, and the fix for browsers without it (Safari)
  if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - anchorTop);
}

const nextSentinel = ref<HTMLElement | null>(null);
const SENTINEL_PRELOAD_PX = 1200;
let sentinelObserver: IntersectionObserver | null = null;

function loadMoreIfSentinelVisible() {
  const el = nextSentinel.value;
  if (el && el.getBoundingClientRect().top < window.innerHeight + SENTINEL_PRELOAD_PX) {
    loadNextPage();
  }
}

watch(nextSentinel, (el, oldEl) => {
  if (oldEl) sentinelObserver?.unobserve(oldEl);
  if (el) sentinelObserver?.observe(el);
});

// Track the first ayah under the header: drives the Mushaf page shown in the
// header/canonical, and is mirrored into the address bar as /2/N once
// scrolling settles (debounced — Safari throttles rapid history updates)
const URL_SYNC_DELAY_MS = 400;
let scrollRaf = 0;
let urlSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncedAyah: number | null = ayahParam ?? 1;
// While the page settles after load, the URL sync must not rewrite a shared /2/255
const INITIAL_SCROLL_SETTLE_MS = 4000;
let urlSyncPausedUntil = 0;
let disposePin: (() => void) | null = null;

/**
 * Keep a linked ayah at the top while content above it settles (word glyphs
 * and QCF fonts load after hydration and change row heights). Released on
 * the reader's first scroll input or after the settle window. Explicit
 * re-alignment because Safari has no CSS scroll anchoring.
 */
function pinToAyah(ayah: number): () => void {
  const align = () => {
    const el = document.getElementById(`ayah-${ayah}`);
    if (!el) return;
    const drift = el.getBoundingClientRect().top - 72;
    if (Math.abs(drift) > 2) window.scrollBy(0, drift);
  };
  const resizeObserver = new ResizeObserver(align);
  const container = document.querySelector("main");
  if (container) resizeObserver.observe(container);
  align();

  const inputEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  const release = () => {
    resizeObserver.disconnect();
    clearTimeout(releaseTimer);
    inputEvents.forEach((e) => window.removeEventListener(e, release));
    urlSyncPausedUntil = Date.now();
  };
  const releaseTimer = setTimeout(release, INITIAL_SCROLL_SETTLE_MS);
  inputEvents.forEach((e) => window.addEventListener(e, release, { passive: true }));
  return release;
}

function firstVisibleAyah(): number | null {
  const rows = document.querySelectorAll<HTMLElement>("[id^=ayah-]");
  for (const row of rows) {
    if (row.getBoundingClientRect().bottom > 120) {
      return Number(row.id.slice("ayah-".length));
    }
  }
  return null;
}

function updateVisiblePage() {
  scrollRaf = 0;
  const ayah = firstVisibleAyah();
  if (!ayah) return;
  const page = resolvePageForAyah(ayah, mushafPageList.value);
  if (page && page !== currentPage.value) currentPage.value = page;
}

/**
 * Keep the current /N/{ayah} while that ayah is still in the upper half of the
 * view — or anywhere in view once scrolled to the bottom, where late ayahs
 * (e.g. /2/286) can never reach the top. Avoids rewriting shared links.
 */
function isSyncedAyahStillInView(): boolean {
  const el = lastSyncedAyah ? document.getElementById(`ayah-${lastSyncedAyah}`) : null;
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.bottom <= 120 || rect.top >= window.innerHeight) return false;
  const atBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  return atBottom || rect.top < window.innerHeight / 2;
}

function syncUrlToVisibleAyah() {
  urlSyncTimer = null;
  const pausedFor = urlSyncPausedUntil - Date.now();
  if (pausedFor > 0) {
    urlSyncTimer = setTimeout(syncUrlToVisibleAyah, pausedFor);
    return;
  }
  // Old page instance still mounted while the next surah loads
  if (isTornDown || router.currentRoute.value.params.id !== String(surahId)) return;
  if (isSyncedAyahStillInView()) return;
  const ayah = firstVisibleAyah();
  if (!ayah || ayah === lastSyncedAyah) return;
  lastSyncedAyah = ayah;
  router.replace({
    params: { id: String(surahId), ayah: ayah === 1 ? undefined : String(ayah) },
    query: { ...route.query, play: undefined },
  });
}

function onScroll() {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(updateVisiblePage);
  if (urlSyncTimer) clearTimeout(urlSyncTimer);
  urlSyncTimer = setTimeout(syncUrlToVisibleAyah, URL_SYNC_DELAY_MS);
}

// Runs as soon as navigation to another surah/route starts: the old instance
// stays mounted (and reactive) until the next page resolves in <Suspense>
function teardown() {
  if (isTornDown) return;
  isTornDown = true;
  recitation.stop();
  disposePin?.();
  sentinelObserver?.disconnect();
  window.removeEventListener("scroll", onScroll);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  if (urlSyncTimer) clearTimeout(urlSyncTimer);
}

onBeforeRouteUpdate((to) => {
  if (to.params.id !== String(surahId)) teardown();
});
onBeforeRouteLeave(() => teardown());
onBeforeUnmount(teardown);

onMounted(async () => {
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) loadNextPage();
    },
    { rootMargin: `0px 0px ${SENTINEL_PRELOAD_PX}px 0px` },
  );
  if (nextSentinel.value) sentinelObserver.observe(nextSentinel.value);
  window.addEventListener("scroll", onScroll, { passive: true });

  urlSyncPausedUntil = Date.now() + INITIAL_SCROLL_SETTLE_MS;

  // Load word data
  quranStore.fetchVerseWords(surahId);

  // ?reciter= must apply before the prefetch below. Client-only: the setter
  // writes a cookie, which must not end up in an ISR-cached response.
  const reciterParam = Number(route.query.reciter);
  if (isKnownReciter(reciterParam)) recitation.setReciter(reciterParam);
  // Prefetch so the play click can call audio.play() synchronously (iOS autoplay)
  recitation.loadTimings(surahId);

  // ?play starts recitation from the linked ayah. Browsers usually block
  // autoplay without a tap; the player bar then offers "แตะเพื่อเริ่มฟัง".
  if (route.query.play !== undefined) {
    router.replace({ query: { ...route.query, play: undefined } });
    recitation.playVerse(surahId, ayahParam ?? verses.value[0]?.verseNumber ?? 1);
  }

  await readerSettings.fetchTranslationSources();

  if (isTornDown) return;
  // Scroll to the linked ayah (/2/255)
  if (ayahParam) {
    nextTick(() => {
      if (!isTornDown) disposePin = pinToAyah(ayahParam);
    });
  } else {
    scrollToSurahHeader();
  }
});

// External /2/N navigation within this surah (back/forward, in-app links).
// Our own scroll-driven URL sync is ignored via lastSyncedAyah.
watch(
  () => route.params.ayah,
  async (newAyah) => {
    if (isTornDown) return;
    const ayah = parseInt(newAyah as string) || 1;
    if (ayah === lastSyncedAyah) return;
    lastSyncedAyah = ayah;
    disposePin?.();
    const index = mushafPageList.value.findIndex(
      (p) => ayah >= p.verseFrom && ayah <= p.verseTo,
    );
    if (index === -1) {
      showError({ statusCode: 404, statusMessage: "Ayah not found" });
      return;
    }
    if (index < firstLoadedIndex.value || index > lastLoadedIndex.value) {
      const generation = ++loadGeneration;
      const result = await fetchPageVerses(mushafPageList.value[index]!);
      if (!result || !isCurrent(generation)) return;
      currentSourceId.value = result.sourceId;
      verses.value = result.verses;
      firstLoadedIndex.value = index;
      lastLoadedIndex.value = index;
    }
    currentPage.value = mushafPageList.value[index]!.page;
    await nextTick();
    const el = document.getElementById(`ayah-${ayah}`);
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
    }
  },
);

// Recitation: keep one Mushaf page loaded ahead of the reciter
const isRecitingThisSurah = computed(
  () => recitationStatus.value !== "idle" && recitationChapter.value === surahId,
);

function scrollToActiveVerse() {
  nextTick(() => {
    const verse = activeVerseKey.value?.split(":")[1];
    const el = verse ? document.getElementById(`ayah-${verse}`) : null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Only scroll when the verse has drifted out of the comfortable reading zone
    if (rect.top < 72 || rect.top > window.innerHeight * 0.6) {
      window.scrollTo({ top: rect.top + window.scrollY - 88, behavior: "smooth" });
    }
  });
}

watch(activeVerseKey, async (key) => {
  if (!key || !isRecitingThisSurah.value) return;
  const verseNumber = Number(key.split(":")[1]);
  if (lastLoadedPage.value && verseNumber >= lastLoadedPage.value.verseFrom) {
    await loadNextPage();
  }
  scrollToActiveVerse();
});

// Translation source change: reload every loaded Mushaf page in place.
// Load-more is paused meanwhile so the reloaded range can't drop new pages.
watch(
  () => selectedSourceId.value,
  async () => {
    if (isTornDown) return;
    // The cookie now holds the choice; a stale ?translation= would override it on reload
    if (route.query.translation !== undefined) {
      router.replace({ query: { ...route.query, translation: undefined } });
    }
    const generation = ++loadGeneration;
    reloadingGeneration = generation;
    const pages = mushafPageList.value.slice(
      firstLoadedIndex.value,
      lastLoadedIndex.value + 1,
    );
    const results = await Promise.all(pages.map(fetchPageVerses));
    if (reloadingGeneration === generation) reloadingGeneration = null;
    if (!isCurrent(generation)) return;
    if (results.every((r) => r !== null)) {
      currentSourceId.value = results[0]!.sourceId;
      verses.value = results.flatMap((r) => r!.verses);
    }
    await nextTick();
    loadMoreIfSentinelVisible();
  },
);

// TODO: re-enable when QuranToolbar is unhidden
// // Toolbar handlers
// function handleBackClick() {
//   const page = currentPageInfo.value;
//   if (page && page.page > 1) {
//     router.push(`/page/${page.page}`);
//   } else {
//     router.push("/");
//   }
// }
// function handlePageChange(page: number) {
//   router.push(`/page/${page}`);
// }

// Pagination navigation (Seamless global navigation across the Mushaf)
const orderedPages = computed(() => {
  const mapping = globalPageMapping.value;
  if (!mapping) return [];
  const list: (MushafPage & { surahId: number; surahName: string })[] = [];
  for (const [sIdStr, pages] of Object.entries(mapping)) {
    const sId = parseInt(sIdStr);
    const surah = allSurahs.value.find((s) => s.id === sId);
    for (const p of pages) {
      list.push({ surahId: sId, surahName: surah?.name_thai || "", ...p });
    }
  }
  // Sort by page first, then by surahId
  list.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.surahId - b.surahId;
  });
  return list;
});

const currentIndex = computed(() => {
  return orderedPages.value.findIndex(
    (p) => p.surahId === surahId && p.page === currentPage.value,
  );
});

const prevPage = computed(() => {
  if (currentIndex.value <= 0) return null;
  return orderedPages.value[currentIndex.value - 1];
});

const nextPage = computed(() => {
  if (
    currentIndex.value === -1 ||
    currentIndex.value >= orderedPages.value.length - 1
  )
    return null;
  return orderedPages.value[currentIndex.value + 1];
});

const pageTitle = computed(() => {
  const siteName = "read.quran.in.th";
  if (!currentSurah.value) return `อ่านอัลกุรอานออนไลน์ พร้อมคำแปลภาษาไทย | ${siteName}`;
  
  const page = currentPageInfo.value;
  const source = currentSourceName.value ? ` (${currentSourceName.value})` : '';
  const ayahRange = page ? `อายะฮ์ที่ ${page.verseFrom}-${page.verseTo}` : "";
  
  return `ซูเราะห์${currentSurah.value.name_thai} (${currentSurah.value.name_meaning_thai})${ayahRange} แปลไทย${source} | ${siteName}`;
});

const pageDescription = computed(() => {
  const ayahRange = currentPageInfo.value ? `ของอายะฮ์ที่ ${currentPageInfo.value.verseFrom}-${currentPageInfo.value.verseTo}` : "ของอายะห์ต่าง ๆ";

  if (!currentSurah.value) {
    return 'อ่านอัลกุรอานออนไลน์พร้อมคำแปลภาษาไทย ฟังเสียงอ่านอัลกุรอาน เลือกอ่านตามซูเราะห์หรือหน้า สะดวกและใช้งานง่าย';
  }

  const source = currentSourceName.value ? `ฉบับ${currentSourceName.value}` : '';
  const surahName = `ซูเราะห์ ${currentSurah.value.name_thai} (${currentSurah.value.name_simple})`;
  
  return `อ่าน${surahName} พร้อมคำแปลภาษาไทย${source} ฟังเสียงอ่านอัลกุรอานออนไลน์ เรียนรู้ความหมายและบริบท${ayahRange}ใน${surahName}`;
});

useSeoMeta({
  title: pageTitle,
  ogTitle: pageTitle,
  description: pageDescription,
  ogDescription: pageDescription,
})

const baseUrl = useRequestURL().origin;
const canonicalUrl = computed(() =>
  currentPageInfo.value
    ? `${baseUrl}${surahPagePath(surahId, currentPageInfo.value)}`
    : `${baseUrl}/${surahId}`,
);

useHead({
  link: computed(() => {
    const links = [{ rel: "canonical", href: canonicalUrl.value }];

    if (prevPage.value) {
      links.push({
        rel: "prev",
        href: `${baseUrl}${surahPagePath(prevPage.value.surahId, prevPage.value)}`,
      });
    }

    if (nextPage.value) {
      links.push({
        rel: "next",
        href: `${baseUrl}${surahPagePath(nextPage.value.surahId, nextPage.value)}`,
      });
    }

    return links;
  }),
})

useSchemaOrg([
  defineBreadcrumb({
    itemListElement: [
      { name: 'หน้าแรก', item: '/' },
      { name: computed(() => currentSurah.value?.name_thai ?? 'ซูเราะห์') },
    ],
  }),
  defineArticle({
    headline: computed(() => currentSurah.value ? `ซูเราะห์ ${currentSurah.value.name_thai}` : 'อัลกุรอานแปลไทย'),
    description: pageDescription,
  }),
])
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-slate-900">
    <!-- TODO: temporarily hidden -->
    <!-- <QuranToolbar
      class="sticky top-0 z-40"
      mode="surah"
      :current-page="currentPageInfo?.page ?? currentPage"
      :total-pages="604"
      @back-click="handleBackClick"
      @settings-click="handleSettingsClick"
      @page-change="handlePageChange"
    /> -->

    <main class="container mx-auto max-w-6xl px-4 py-8 pb-20">
      <!-- Error State -->
      <div
        v-if="fetchStatus === 'error'"
        class="py-12 text-center text-red-600"
      >
        เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง
      </div>
      <div v-else-if="error" class="py-12 text-center text-red-600">
        {{ error }}
      </div>

      <!-- Surah Content -->
      <div
        v-else-if="fetchStatus === 'success' && currentSurah"
        class="space-y-6"
      >
          <!-- Surah Header -->
          <div id="surah-header" class="flex items-center justify-between border-b border-slate-200 pb-2">
            <!-- Left: Surah name (clickable to open surah selection) -->
            <button
              class="text-left cursor-pointer group"
              @click="showSurahModal = true"
            >
              <div class="flex items-baseline gap-2.5">
                <h2 class="text-base sm:text-lg font-bold tracking-tight text-slate-800 group-hover:text-sand-600 transition-colors">
                  {{ currentSurah.name_thai }} <span class="font-arabic">({{ currentSurah.name_arabic }})</span>
                </h2>
                <svg class="w-4 h-4 text-slate-400 group-hover:text-sand-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
              </div>
              <span class="mt-1 text-sm text-slate-400">
                {{ currentSurah.name_meaning_thai }}
              </span>
            </button>

            <!-- Right: Surah info + settings -->
            <div class="flex items-start gap-3 shrink-0">
              <div class="text-right text-sm text-slate-500">
                <div class="flex items-center justify-end gap-2">
                  <span>อายะห์ {{ currentPageInfo?.verseFrom || 1 }}-{{ currentPageInfo?.verseTo || currentSurah.verses_count }}</span>
                  <span v-if="currentPageInfo" class="text-slate-300">·</span>
                  <NuxtLink
                    v-if="currentPageInfo"
                    to="/page/1"
                    class="hover:text-slate-700 underline underline-offset-2"
                    title="อ่านในมุศฮัฟ"
                  >
                    หน้า {{ currentPageInfo.page }}
                  </NuxtLink>
                </div>
                <div class="mt-0.5 text-xs text-slate-400">
                  {{ currentSurah.revelation_place === "makkiyah" ? "มักกียะฮ์" : "มะดะนียะฮ์" }}
                  · {{ currentSurah.verses_count }} อายะห์
                </div>
              </div>
            </div>
          </div>

          <!-- Load previous Mushaf page (crawlable link; JS loads in place) -->
          <a
            v-if="prevUnloadedPage"
            :href="surahPagePath(surahId, prevUnloadedPage)"
            class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-2.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            @click.prevent="loadPrevPage"
          >
            <svg v-if="isLoadingPrev" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            อ่านอายะห์ก่อนหน้า ({{ prevUnloadedPage.verseFrom }}-{{ prevUnloadedPage.verseTo }})
          </a>

          <!-- Scroll anchor for first verse -->
          <div id="first-verse" />

          <!-- Verses grouped by Mushaf page; markers drive ?page=N while scrolling -->
          <template v-for="(group, groupIndex) in loadedPageGroups" :key="group.page?.page ?? 'all'">
            <div
              v-if="group.page"
              :data-mushaf-page="group.page.page"
              class="flex justify-center"
              :class="groupIndex === 0 && 'sr-only'"
            >
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                หน้า {{ group.page.page }}
              </span>
            </div>
            <ReadingVerseRow
              v-for="(verse, verseIndex) in group.verses"
              :key="verse.verseNumber"
              :verse="verse"
              :surah-number="currentSurah.id"
              :surah-name="currentSurah.name_thai"
              :words="quranStore.getWordsForVerse(verse.verseNumber)"
              :is-font-loaded="isFontLoaded"
              :source-id="currentSourceId"
              :source-name="currentSourceName"
              :is-external-source="isExternalSource"
              :disable-actions="true"
              :enable-recitation="true"
              :hide-separator="verseIndex === group.verses.length - 1 && groupIndex < loadedPageGroups.length - 1"
            />
          </template>

          <!-- Next Mushaf page: auto-loads near the viewport; plain link for crawlers -->
          <a
            v-if="nextUnloadedPage"
            ref="nextSentinel"
            :href="surahPagePath(surahId, nextUnloadedPage)"
            class="flex items-center justify-center gap-2 py-6 text-sm text-slate-400"
            @click.prevent="loadNextPage"
          >
            <svg v-if="isLoadingNext" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            อายะห์ {{ nextUnloadedPage.verseFrom }}-{{ nextUnloadedPage.verseTo }}
          </a>

          <!-- End of surah -->
          <a
            v-else-if="nextSurah"
            :href="`/${nextSurah.id}`"
            class="group mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div class="flex flex-col">
              <span class="text-xs text-slate-400">ซูเราะห์ถัดไป</span>
              <span class="text-base font-semibold text-slate-800">
                {{ nextSurah.name_thai }} <span class="font-arabic">({{ nextSurah.name_arabic }})</span>
              </span>
              <span class="text-sm text-slate-400">{{ nextSurah.name_meaning_thai }}</span>
            </div>
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition-colors group-hover:bg-slate-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </a>
        </div>
    </main>

    <ClientOnly>
      <ReadingRecitationPlayerBar />
    </ClientOnly>

    <ReadingSurahSelectionModal
      :visible="showSurahModal"
      :current-surah-id="currentSurah?.id"
      @update:visible="showSurahModal = $event"
      @select="router.push(`/${$event}`)"
    />
  </div>
</template>
