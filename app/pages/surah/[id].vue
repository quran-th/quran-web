<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref, watch, computed } from 'vue'
import { useQuranStore } from '~/stores/quranStore'
import { useReaderSettingsStore } from '~/stores/readerSettingsStore'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { useQcfFont } from '~/composables/useQcfFont'
import QuranToolbar from '~/components/reading/QuranToolbar.vue'

interface MushafPage {
  page: number
  verseFrom: number
  verseTo: number
  verseCount: number
}

const route = useRoute()
const router = useRouter()
const quranStore = useQuranStore()
const fontSettings = useFontSettingsStore()
const readerSettings = useReaderSettingsStore()
const { currentSurah, verses, pagination, loading, error, allWords } = storeToRefs(quranStore)
const { fontVersion } = storeToRefs(fontSettings)
const { selectedSourceId, translationSources } = storeToRefs(readerSettings)

// Initialize QCF font loading
const { isFontLoaded } = useQcfFont(allWords, fontVersion)

// Settings modal
const showSettingsModal = ref(false)

// Parse query parameters
const pageParam = parseInt(route.query.page as string) || null
const surahId = parseInt(route.params.id as string)

const validSourceId = selectedSourceId.value && selectedSourceId.value > 0
  ? selectedSourceId.value
  : undefined

// Fetch Mushaf page mapping
const { data: mushafPagesData } = await useAsyncData(
  `surah-${surahId}-mushaf-pages`,
  () => $fetch(`/api/surahs/${surahId}/mushaf-pages`)
)

const currentPage = ref<number>(1)

// Determine current page from query param or default to first page
if (pageParam && mushafPagesData.value) {
  const pageExists = (mushafPagesData.value as any).data?.find(
    (p: MushafPage) => p.page === pageParam
  )
  currentPage.value = pageExists ? pageParam : 1
} else {
  currentPage.value = 1
}

// Get current page info - use mushafPagesData directly for SSR compatibility
const currentPageInfo = computed(() => {
  const pages = (mushafPagesData.value as any)?.data as MushafPage[] | undefined
  if (!pages || !pages.length) return null
  return pages.find(p => p.page === currentPage.value) || pages[0]
})

// Store Mushaf pages ref for client-side operations
const mushafPages = ref<MushafPage[]>([])

// SSR: Fetch verses for current Mushaf page
const pageInfo = currentPageInfo.value
const offset = pageInfo ? pageInfo.verseFrom - 1 : 0
const limit = pageInfo ? pageInfo.verseTo - pageInfo.verseFrom + 1 : 50

const { data: ssrData, status: fetchStatus } = await useAsyncData(
  `surah-${surahId}-page-${currentPage.value}`,
  async () => {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    })
    if (validSourceId) {
      params.set('sourceId', validSourceId.toString())
    }
    const url = `/api/surahs/${surahId}?${params.toString()}`
    const response = await $fetch(url)
    return response
  }
)

// Client-side loading: covers both surah navigation (useAsyncData pending) and page pagination (store loading)
const isClientLoading = computed(() =>
  import.meta.client && (fetchStatus.value === 'pending' || loading.value)
)

// Hydrate store and pages
if (ssrData.value && (ssrData.value as any).success) {
  const data = (ssrData.value as any).data
  currentSurah.value = {
    id: data.id,
    name_simple: data.name_simple,
    name_arabic: data.name_arabic,
    name_thai: data.name_thai,
    englishName: data.name_simple,
    englishNameTranslation: data.name_thai,
    revelation_place: data.revelation_place,
    verses_count: data.verses_count,
  }
  verses.value = data.verses
  pagination.value = data.pagination
}

// Store Mushaf pages on mount
onMounted(async () => {
  if (mushafPagesData.value && (mushafPagesData.value as any).success) {
    mushafPages.value = (mushafPagesData.value as any).data
  }

  // Load word data
  quranStore.fetchVerseWords(surahId)

  await readerSettings.fetchTranslationSources()
})

// Watch for page changes
watch(() => route.query.page, (newPage) => {
  const pageNum = newPage ? parseInt(newPage as string) : 1
  const pages = (mushafPagesData.value as any)?.data as MushafPage[] | undefined
  const page = pages?.find(p => p.page === pageNum)

  if (page && page.page !== currentPage.value) {
    currentPage.value = page.page
    // Fetch verses for this page
    const offset = page.verseFrom - 1
    const limit = page.verseTo - page.verseFrom + 1
    quranStore.fetchVerses(surahId, validSourceId, offset, limit)
  }
})

// Watch for surah changes
watch(() => route.params.id, (newId) => {
  if (newId) {
    const id = parseInt(newId as string)
    router.push(`/surah/${id}`)
  }
})

function handleSourceChange(sourceId: number) {
  readerSettings.setTranslationSource(sourceId)
  const surahId = parseInt(route.params.id as string)
  const validSourceId = sourceId > 0 ? sourceId : undefined

  const page = currentPageInfo.value
  if (page) {
    const offset = page.verseFrom - 1
    const limit = page.verseTo - page.verseFrom + 1
    quranStore.fetchVerses(surahId, validSourceId, offset, limit)
  }
}

// Toolbar handlers
function handleBackClick() {
  const page = currentPageInfo.value
  if (page && page.page > 1) {
    router.push(`/page/${page.page}`)
  } else {
    router.push('/')
  }
}

function handleSettingsClick() {
  showSettingsModal.value = true
}

function handlePageChange(page: number) {
  router.push(`/page/${page}`)
}

// Pagination navigation
const prevPage = computed(() => {
  const pages = (mushafPagesData.value as any)?.data as MushafPage[] | undefined
  if (!pages || currentPage.value <= 1) return null
  return pages.find(p => p.page === currentPage.value - 1)
})

const nextPage = computed(() => {
  const pages = (mushafPagesData.value as any)?.data as MushafPage[] | undefined
  if (!pages) return null
  const currentIndex = pages.findIndex(p => p.page === currentPage.value)
  if (currentIndex === -1 || currentIndex === pages.length - 1) return null
  return pages[currentIndex + 1]
})

// SEO metadata
const canonicalUrl = computed(() => {
  const baseUrl = 'https://quran.in.th'
  const pageQuery = currentPage.value > 1 ? `?page=${currentPage.value}` : ''
  return `${baseUrl}/surah/${surahId}${pageQuery}`
})

useHead({
  title: computed(() => {
    if (!currentSurah.value) return 'อัลกุรอานแปลไทย'
    const page = currentPageInfo.value
    const pageText = page && page.page > 1 ? ` (หน้า ${page.page})` : ''
    return `ซูเราะห์ ${currentSurah.value.name_simple}${pageText} - อัลกุรอานแปลไทย`
  }),
  link: computed(() => {
    const links = [{ rel: 'canonical', href: canonicalUrl.value }]

    if (prevPage.value) {
      links.push({
        rel: 'prev',
        href: `${canonicalUrl.value.split('?')[0]}?page=${prevPage.value.page}`
      })
    }

    if (nextPage.value) {
      links.push({
        rel: 'next',
        href: `${canonicalUrl.value.split('?')[0]}?page=${nextPage.value.page}`
      })
    }

    return links
  })
})
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-slate-900">
    <!-- Toolbar -->
    <QuranToolbar
      v-if="currentPageInfo"
      mode="surah"
      :current-page="currentPageInfo.page"
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
                <animate attributeName="stroke-dasharray" values="0,100;100,0" dur="2s" repeatCount="indefinite" />
              </path>
              <path d="M30 10v5h5">
                <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
              </path>
              <path d="M20 20h10M20 25h10M20 30h10">
                <animate attributeName="stroke-dasharray" values="0,60;60,0" dur="2s" repeatCount="indefinite" />
              </path>
            </g>
          </svg>
        </div>
      </ClientOnly>

      <!-- Error State -->
      <div v-if="fetchStatus === 'error'" class="py-12 text-center text-red-600">
        เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง
      </div>
      <div v-else-if="error" class="py-12 text-center text-red-600">
        {{ error }}
      </div>

      <!-- Surah Content — fetchStatus === 'success' is hydration-safe (SSR cache is immediately available on client) -->
      <div v-else-if="fetchStatus === 'success' && currentSurah" class="space-y-6">
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
          <div class="flex justify-center gap-6 pt-4 text-sm font-semibold tracking-wider text-slate-400 uppercase">
            <span class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {{ currentSurah.revelation_place === 'meccan' ? 'มักกียะฮ์' : 'มะดะนียะฮ์' }}
            </span>
            <span class="text-slate-200">|</span>
            <span class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
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

          <!-- Translation source selector (client-only: fetched after mount, never part of SSR HTML) -->
          <ClientOnly>
            <div v-if="translationSources.length > 0" class="flex justify-center pt-2">
              <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                <span class="text-xs font-medium tracking-wider text-slate-400 uppercase">คำแปล</span>
                <div class="flex gap-1">
                  <button
                    v-for="source in translationSources"
                    :key="source.id"
                    class="rounded-lg px-3 py-1 text-sm font-medium transition-colors duration-150"
                    :class="
                      selectedSourceId === source.id
                        ? 'border border-slate-200 bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    "
                    @click="handleSourceChange(source.id)"
                  >
                    {{ source.shortName ?? source.name }}
                  </button>
                </div>
              </div>
            </div>
          </ClientOnly>
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
          :surah-name="currentSurah.name_simple"
          :words="quranStore.getWordsForVerse(verse.verseNumber)"
          :is-font-loaded="isFontLoaded"
        />

        <!-- Mushaf Page Pagination -->
        <nav v-if="mushafPagesData && mushafPagesData.data && mushafPagesData.data.length > 0" class="pagination-container">
          <div class="pagination flex flex-wrap justify-center gap-2 py-8">
            <!-- Previous Button -->
            <NuxtLink
              v-if="prevPage"
              :to="`?page=${prevPage.page}`"
              class="pagination-link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6 6-6"/>
              </svg>
              <span class="ml-1">ก่อนหน้า</span>
            </NuxtLink>

            <!-- Page Numbers -->
            <NuxtLink
              v-for="page in mushafPagesData.data"
              :key="page.page"
              :to="`?page=${page.page}`"
              class="pagination-link"
              :class="{ 'pagination-link--active': page.page === currentPage }"
            >
              <div class="text-center">
                <div class="page-number">หน้า {{ page.page }}</div>
                <div class="verse-range">อายะห์ {{ page.verseFrom }}-{{ page.verseTo }}</div>
                <div class="text-xs text-slate-400">{{ page.verseCount }} อายะห์</div>
              </div>
            </NuxtLink>

            <!-- Next Button -->
            <NuxtLink
              v-if="nextPage"
              :to="`?page=${nextPage.page}`"
              class="pagination-link"
            >
              <span class="mr-1">หน้าถัดไป</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6 6 6"/>
              </svg>
            </NuxtLink>
          </div>
        </nav>
      </div>
    </main>

    <!-- Font Settings Modal -->
    <SettingsFontSettingsModal v-model:visible="showSettingsModal" />
  </div>
</template>

<style scoped>
.pagination-link {
  @apply px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-150;
  min-width: 100px;
}

.pagination-link--active {
  @apply border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100;
}

.pagination-link .page-number {
  @apply font-semibold text-sm;
}

.pagination-link .verse-range {
  @apply text-xs text-slate-500;
}

.pagination-link--active .verse-range {
  @apply text-blue-600;
}
</style>
