<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, watch } from 'vue'
import { useQuranStore } from '~/stores/quranStore'
import { useReaderSettingsStore } from '~/stores/readerSettingsStore'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { useQcfFont } from '~/composables/useQcfFont'

const route = useRoute()
const quranStore = useQuranStore()
const fontSettings = useFontSettingsStore()
const readerSettings = useReaderSettingsStore()
const { currentSurah, loading, error, allWords } = storeToRefs(quranStore)
const { fontVersion } = storeToRefs(fontSettings)
const { selectedSourceId, translationSources } = storeToRefs(readerSettings)

// Initialize QCF font loading — loads per-page font files as words arrive
const { isFontLoaded } = useQcfFont(allWords, fontVersion)

onMounted(async () => {
  const surahId = parseInt(route.params.id as string)
  await readerSettings.fetchTranslationSources()
  quranStore.fetchSurah(surahId, selectedSourceId.value)
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      quranStore.fetchSurah(parseInt(newId as string), selectedSourceId.value)
    }
  }
)

function handleSourceChange(sourceId: number) {
  readerSettings.setTranslationSource(sourceId)
  const surahId = parseInt(route.params.id as string)
  quranStore.fetchSurah(surahId, sourceId)
}

useHead({
  title: computed(() =>
    currentSurah.value
      ? `ซูเราะห์ ${currentSurah.value.name_simple} - อัลกุรอานแปลไทย`
      : 'อัลกุรอานแปลไทย'
  ),
})
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-slate-900">
    <main class="container mx-auto max-w-6xl px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
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

      <!-- Error State -->
      <div v-else-if="error" class="py-12 text-center text-red-600">
        {{ error }}
      </div>

      <!-- Surah Content -->
      <div v-else-if="currentSurah" class="space-y-6">
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

          <!-- Translation source selector -->
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
          v-for="verse in currentSurah.verses"
          :key="verse.verseNumber"
          :verse="verse"
          :surah-number="currentSurah.id"
          :surah-name="currentSurah.name_simple"
          :words="quranStore.getWordsForVerse(verse.verseNumber)"
          :is-font-loaded="isFontLoaded"
        />
      </div>
    </main>
  </div>
</template>
