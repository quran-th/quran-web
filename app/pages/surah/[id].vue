<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch, computed } from "vue";
import { useQuranStore } from "~/stores/quranStore";
import type { Verse, Pagination } from "~/stores/quranStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useQcfFont } from "~/composables/useQcfFont";
import QuranToolbar from "~/components/reading/QuranToolbar.vue";

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
const {
  currentSurah,
  verses,
  pagination,
  loading,
  error,
  allWords,
  currentSourceId,
} = storeToRefs(quranStore);
const { fontVersion } = storeToRefs(fontSettings);
const { selectedSourceId } = storeToRefs(readerSettings);

// Initialize QCF font loading
const { isFontLoaded } = useQcfFont(allWords, fontVersion);

// Settings modal
const showSettingsModal = ref(false);

// Parse query parameters
const pageParam = parseInt(route.query.page as string) || null;
const surahId = parseInt(route.params.id as string);

const validSourceId =
  selectedSourceId.value && selectedSourceId.value > 0
    ? selectedSourceId.value
    : undefined;

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

// Determine current page from query param or default to first page
if (pageParam && mushafPagesData.value) {
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
  `surah-${surahId}-page-${currentPage.value}`,
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

// Client-side loading: covers both surah navigation (useAsyncData pending) and page pagination (store loading)
const isClientLoading = computed(
  () =>
    import.meta.client && (fetchStatus.value === "pending" || loading.value),
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

// Store Mushaf pages on mount
onMounted(async () => {
  if (mushafPagesData.value && mushafPagesData.value.success) {
    mushafPages.value = mushafPagesData.value.data;
  }

  // Load word data
  quranStore.fetchVerseWords(surahId);

  await readerSettings.fetchTranslationSources();
});

// Watch for page changes
watch(
  () => route.query.page,
  (newPage) => {
    const pageNum = newPage ? parseInt(newPage as string) : 1;
    const pages = mushafPagesData.value?.data;
    const page = pages?.find((p) => p.page === pageNum);

    if (page && page.page !== currentPage.value) {
      currentPage.value = page.page;
      // Fetch verses for this page
      const offset = page.verseFrom - 1;
      const limit = page.verseTo - page.verseFrom + 1;
      quranStore.fetchVerses(surahId, validSourceId, offset, limit, true);
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
    const validSourceId = newId && newId > 0 ? newId : undefined;

    const page = currentPageInfo.value;
    if (page) {
      const offset = page.verseFrom - 1;
      const limit = page.verseTo - page.verseFrom + 1;
      quranStore.fetchVerses(surahId, validSourceId, offset, limit, true);
    }
  },
);

// Toolbar handlers
function handleBackClick() {
  const page = currentPageInfo.value;
  if (page && page.page > 1) {
    router.push(`/page/${page.page}`);
  } else {
    router.push("/");
  }
}

function handleSettingsClick() {
  showSettingsModal.value = true;
}

function handlePageChange(page: number) {
  router.push(`/page/${page}`);
}

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

// SEO metadata
const baseUrl = "https://quran.in.th";
const canonicalUrl = computed(() => {
  const pageQuery = currentPage.value > 1 ? `?page=${currentPage.value}` : "";
  return `${baseUrl}/surah/${surahId}${pageQuery}`;
});

useHead({
  title: computed(() => {
    if (!currentSurah.value) return "อัลกุรอานแปลไทย";
    const page = currentPageInfo.value;
    const pageText = page && page.page > 1 ? ` (หน้า ${page.page})` : "";
    return `ซูเราะห์ ${currentSurah.value.name_simple}${pageText} - อัลกุรอานแปลไทย`;
  }),
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
});
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-slate-900">
    <!-- Toolbar -->
    <QuranToolbar
      class="sticky top-0 z-40"
      mode="surah"
      :current-page="currentPageInfo?.page ?? currentPage"
      :total-pages="604"
      @back-click="handleBackClick"
      @settings-click="handleSettingsClick"
      @page-change="handlePageChange"
    />

    <main class="container mx-auto max-w-6xl px-4 py-8">
      <!-- Loading State (client-only — never rendered during SSR to avoid hydration mismatch) -->
      <ClientOnly>
        <div v-if="isClientLoading" class="flex justify-center py-12">
          <svg width="60" height="60" viewBox="0 0 50 50">
            <g fill="none" stroke="#60A5FA" stroke-width="2">
              <path d="M15 10h15l5 5v20H15V10">
                <animate
                  attributeName="stroke-dasharray"
                  values="0,100;100,0"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M30 10v5h5">
                <animate
                  attributeName="opacity"
                  values="0;1;0"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M20 20h10M20 25h10M20 30h10">
                <animate
                  attributeName="stroke-dasharray"
                  values="0,60;60,0"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        </div>
      </ClientOnly>

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

      <!-- Surah Content — fetchStatus === 'success' is hydration-safe (SSR cache is immediately available on client) -->
      <div
        v-else-if="fetchStatus === 'success' && currentSurah"
        class="space-y-6"
      >
        <!-- Surah Header -->
        <div class="space-y-4 border-b border-slate-200 py-10 text-center">
          <h1 class="font-arabic mb-4 text-5xl text-slate-900">
            {{ currentSurah.name_arabic }}
          </h1>
          <h2 class="text-3xl font-bold tracking-tight text-slate-800">
            ซูเราะห์ {{ currentSurah.name_simple }}
          </h2>
          <p class="text-xl font-medium text-slate-500">
            {{ currentSurah.name_thai }}
          </p>
          <div
            class="flex justify-center gap-6 pt-4 text-sm font-semibold tracking-wider text-slate-400 uppercase"
          >
            <span class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {{
                currentSurah.revelation_place === "meccan"
                  ? "มักกียะฮ์"
                  : "มะดะนียะฮ์"
              }}
            </span>
            <span class="text-slate-200">|</span>
            <span class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"
                />
                <path d="M8 7h6" />
                <path d="M8 11h8" />
              </svg>
              {{ currentSurah.verses_count }} อายะห์
            </span>
          </div>

          <!-- Current page info -->
          <div v-if="currentPageInfo" class="pt-2 text-sm text-slate-500">
            <NuxtLink
              to="/page/1"
              class="hover:text-slate-700 underline"
              title="อ่านในมุษอฟ"
            >
              มุษอฟ หน้า {{ currentPageInfo.page }}
            </NuxtLink>
            <span class="mx-2">•</span>
            อายะห์ {{ currentPageInfo.verseFrom }}-{{ currentPageInfo.verseTo }}
          </div>
        </div>

        <!-- Bismillah -->
        <div
          v-if="currentSurah.id !== 1 && currentSurah.id !== 9"
          class="font-arabic py-10 text-center text-4xl text-slate-800"
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>

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
        />

        <!-- Mushaf Page Pagination -->
        <nav
          v-if="
            mushafPagesData &&
            mushafPagesData.data &&
            mushafPagesData.data.length > 0
          "
          class="border-t border-slate-100 pb-6 pt-10 mt-8"
        >
          <div class="grid grid-cols-3 items-center gap-4">
            <!-- Previous Button -->
            <div class="flex justify-start">
              <NuxtLink
                v-if="prevPage"
                :to="`/surah/${prevPage.surahId}?page=${prevPage.page}`"
                class="group flex flex-col items-start justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm transition-all duration-150 hover:border-blue-300 hover:shadow-md sm:min-w-32"
              >
                <div
                  class="flex items-center text-sm font-medium text-slate-500 group-hover:text-blue-600 mb-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mr-1"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  ก่อนหน้า
                </div>
                <span
                  class="font-bold text-slate-900 group-hover:text-blue-700"
                  >{{ prevPage.surahName || currentSurah?.name_thai }}</span
                >
                <span
                  class="text-xs text-slate-500 mt-0.5 group-hover:text-blue-500"
                  >อายะห์ {{ prevPage.verseFrom }}-{{ prevPage.verseTo }}</span
                >
              </NuxtLink>
            </div>

            <!-- Current page data -->
            <div class="flex flex-col items-center justify-center text-center">
              <div
                v-if="currentSurah"
                class="text-base sm:text-lg font-bold text-slate-900"
              >
                {{ currentSurah.name_thai }}
              </div>
              <div
                v-if="mushafPagesData"
                class="flex flex-col items-center gap-1.5 mt-1"
              >
                <span class="text-sm text-slate-500">
                  หน้า {{ currentPage }} จาก 604
                </span>
                <div class="flex items-center gap-2">
                  <span
                    class="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                  >
                    ญุซที่ {{ Math.ceil(currentPage / 20) }}
                  </span>
                  <span
                    class="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                  >
                    ฮิซบ์ที่ {{ Math.ceil(currentPage / 10) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Next Button -->
            <div class="flex justify-end">
              <NuxtLink
                v-if="nextPage"
                :to="`/surah/${nextPage.surahId}?page=${nextPage.page}`"
                class="group flex flex-col items-end justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm transition-all duration-150 hover:border-blue-300 hover:shadow-md sm:min-w-32"
              >
                <div
                  class="flex items-center text-sm font-medium text-slate-500 group-hover:text-blue-600 mb-1"
                >
                  ถัดไป
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="ml-1"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
                <span
                  class="font-bold text-slate-900 group-hover:text-blue-700"
                  >{{ nextPage.surahName || currentSurah?.name_thai }}</span
                >
                <span
                  class="text-xs text-slate-500 mt-0.5 group-hover:text-blue-500"
                  >อายะห์ {{ nextPage.verseFrom }}-{{ nextPage.verseTo }}</span
                >
              </NuxtLink>
            </div>
          </div>
        </nav>
      </div>
    </main>

    <!-- Font Settings Modal -->
    <SettingsReaderSettingsModal v-model:visible="showSettingsModal" />
  </div>
</template>
