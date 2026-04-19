<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick, resolveComponent } from "vue";
import { useQuranStore } from "~/stores/quranStore";
import type { Verse, Pagination } from "~/stores/quranStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useQcfFont } from "~/composables/useQcfFont";
// TODO: re-enable when QuranToolbar is unhidden
// import QuranToolbar from "~/components/reading/QuranToolbar.vue";

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

// Parse query parameters
const pageParam = parseInt(route.query.page as string) || null;
const ayahParam = parseInt(route.query.ayah as string) || null;
const sourceParam = parseInt(route.query.translation as string) || null;
const surahId = parseInt(route.params.id as string);

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
  currentPage.value = resolved ?? firstPageNumber;
} else if (pageParam && mushafPagesData.value) {
  const pageExists = mushafPagesData.value.data?.find(
    (p: MushafPage) => p.page === pageParam,
  );
  currentPage.value = pageExists ? pageParam : firstPageNumber;
}

// Get current page info - use mushafPagesData directly for SSR compatibility
const currentPageInfo = computed(() => {
  const pages = mushafPagesData.value?.data;
  if (!pages || !pages.length) return null;
  return pages.find((p) => p.page === currentPage.value) || pages[0];
});

// Store Mushaf pages ref for client-side operations
const mushafPages = ref<MushafPage[]>([]);

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

function scrollToFirstVerse() {
  nextTick(() => {
    const el = document.getElementById("first-verse");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: "smooth" });
  });
}

// Navigation loading state — shows spinner on clicked button until SSR page loads
const navDirection = ref<"prev" | "next" | null>(null);
const showSurahModal = ref(false);
function onNavClick(dir: "prev" | "next") {
  navDirection.value = dir;
}

// Bottom nav auto-hide on scroll
const isNavVisible = ref(true);
let scrollTimer: ReturnType<typeof setTimeout> | null = null;

function onScrollActivity() {
  isNavVisible.value = false;
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    isNavVisible.value = true;
  }, 400);
}

if (import.meta.client) {
  window.addEventListener("scroll", onScrollActivity, { passive: true });
  window.addEventListener("touchmove", onScrollActivity, { passive: true });
}

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener("scroll", onScrollActivity);
    window.removeEventListener("touchmove", onScrollActivity);
    if (scrollTimer) clearTimeout(scrollTimer);
  }
});

// Store Mushaf pages on mount
onMounted(async () => {
  if (mushafPagesData.value && mushafPagesData.value.success) {
    mushafPages.value = mushafPagesData.value.data;
  }

  // Load word data
  quranStore.fetchVerseWords(surahId);

  await readerSettings.fetchTranslationSources();

  // Scroll to specific ayah if ?ayah=N is present
  if (ayahParam) {
    nextTick(() => {
      const el = document.getElementById(`ayah-${ayahParam}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  } else {
    scrollToFirstVerse();
  }
});

// Watch for page changes
watch(
  () => route.query.page,
  async (newPage) => {
    const pageNum = newPage ? parseInt(newPage as string) : 1;
    const pages = mushafPagesData.value?.data;
    const page = pages?.find((p) => p.page === pageNum);

    if (page && page.page !== currentPage.value) {
      currentPage.value = page.page;
      // Fetch verses for this page
      const offset = page.verseFrom - 1;
      const limit = page.verseTo - page.verseFrom + 1;
      await quranStore.fetchVerses(
        surahId,
        effectiveSourceId.value,
        offset,
        limit,
        true,
      );
      scrollToFirstVerse();
    }
  },
);

// Watch for surah changes
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      const id = parseInt(newId as string);
      router.push(`/surah/${id}`);
    }
  },
);

// Watch for selected translation source changes
watch(
  () => selectedSourceId.value,
  (newId) => {
    const surahId = parseInt(route.params.id as string);
    const nextSourceId =
      (newId && newId > 0 ? newId : undefined) ?? currentSourceId.value;

    const page = currentPageInfo.value;
    if (page) {
      const offset = page.verseFrom - 1;
      const limit = page.verseTo - page.verseFrom + 1;
      quranStore.fetchVerses(surahId, nextSourceId, offset, limit, true);
    }
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
const canonicalUrl = computed(() => {
  const pageQuery = currentPage.value > 1 ? `?page=${currentPage.value}` : "";
  return `${baseUrl}/surah/${surahId}${pageQuery}`;
});

useHead({
  link: computed(() => {
    const links = [{ rel: "canonical", href: canonicalUrl.value }];

    if (prevPage.value) {
      links.push({
        rel: "prev",
        href: `${baseUrl}/surah/${prevPage.value.surahId}?page=${prevPage.value.page}`,
      });
    }

    if (nextPage.value) {
      links.push({
        rel: "next",
        href: `${baseUrl}/surah/${nextPage.value.surahId}?page=${nextPage.value.page}`,
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
          <div class="flex items-center justify-between border-b border-slate-200 pb-2">
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

          <!-- Scroll anchor for first verse -->
          <div id="first-verse" />

          <!-- Verses List -->
          <ReadingVerseRow
            v-for="verse in verses"
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
          />
        </div>

      <!-- Mushaf Page Pagination (sticky bottom, auto-hide on scroll) -->
      <nav
        v-if="
          mushafPagesData &&
          mushafPagesData.data &&
          mushafPagesData.data.length > 0
        "
        class="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xs border-t border-slate-100 px-4 py-2.5 transition-transform duration-200 ease-out"
        :class="isNavVisible ? 'translate-y-0' : 'md:translate-y-0 translate-y-full'"
      >
        <div class="container mx-auto max-w-6xl flex items-center justify-between">
          <!-- Previous Button (plain <a> for SSR navigation) -->
          <a
            v-if="prevPage"
            :href="`/surah/${prevPage.surahId}?page=${prevPage.page}`"
            class="group flex items-center gap-3 text-slate-600 transition-colors hover:text-slate-900"
            @click="onNavClick('prev')"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition-colors" :class="prevPage && 'group-hover:bg-slate-900'">
              <svg v-if="navDirection !== 'prev'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              <svg v-else class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            </span>
            <div class="flex flex-col">
              <span class="text-xs text-slate-400 sm:hidden">ก่อนหน้า</span>
              <span class="hidden text-sm font-medium sm:block">{{ prevPage?.surahName || currentSurah?.name_thai }}</span>
              <span class="hidden text-xs text-slate-400 sm:block">{{ prevPage ? `อายะห์ ${prevPage.verseFrom}-${prevPage.verseTo}` : '' }}</span>
            </div>
          </a>
          <span
            v-else
            class="flex items-center gap-3 text-slate-600 opacity-30 cursor-not-allowed pointer-events-none"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </span>
            <div class="flex flex-col">
              <span class="text-xs text-slate-400 sm:hidden">ก่อนหน้า</span>
              <span class="hidden text-sm font-medium sm:block">{{ currentSurah?.name_thai }}</span>
            </div>
          </span>

          <!-- Current page info -->
          <span class="text-xs text-slate-400">
            {{ currentPage }} / 604
          </span>

          <!-- Next Button (plain <a> for SSR navigation) -->
          <a
            v-if="nextPage"
            :href="`/surah/${nextPage.surahId}?page=${nextPage.page}`"
            class="group flex items-center gap-3 text-slate-600 transition-colors hover:text-slate-900"
            @click="onNavClick('next')"
          >
            <div class="flex flex-col items-end">
              <span class="text-xs text-slate-400 sm:hidden">ถัดไป</span>
              <span class="hidden text-sm font-medium sm:block">{{ nextPage.surahName || currentSurah?.name_thai }}</span>
              <span class="hidden text-xs text-slate-400 sm:block">{{ `อายะห์ ${nextPage.verseFrom}-${nextPage.verseTo}` }}</span>
            </div>
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition-colors group-hover:bg-slate-900">
              <svg v-if="navDirection !== 'next'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              <svg v-else class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            </span>
          </a>
          <span
            v-else
            class="flex items-center gap-3 text-slate-600 opacity-30 cursor-not-allowed pointer-events-none"
          >
            <div class="flex flex-col items-end">
              <span class="text-xs text-slate-400 sm:hidden">ถัดไป</span>
              <span class="hidden text-sm font-medium sm:block">{{ currentSurah?.name_thai }}</span>
            </div>
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </span>
        </div>
      </nav>
    </main>

    <ReadingSurahSelectionModal
      :visible="showSurahModal"
      :current-surah-id="currentSurah?.id"
      @update:visible="showSurahModal = $event"
      @select="router.push(`/surah/${$event}`)"
    />
  </div>
</template>
