<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useQuranStore } from '~/stores/quranStore'

const quranStore = useQuranStore()
const { surahs } = storeToRefs(quranStore)

const searchQuery = ref('')
const { filteredSurahs } = useSurahSearch(surahs, searchQuery)

const { t } = useI18n()

onMounted(() => {
  if (surahs.value.length === 0) {
    quranStore.fetchSurahs()
  }
})
</script>

<template>
  <div class="mx-auto max-w-screen-lg">
    <ReadingSurahSearchBox v-model="searchQuery" class="mb-6 max-w-md mx-auto" />

    <div v-if="searchQuery" class="mb-4 text-center text-xs text-slate-400">
      {{ t('surah_selector.results_count_for', { count: filteredSurahs.length }) }} <span class="font-semibold">{{ searchQuery }}</span>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="surah in filteredSurahs"
        :key="surah.id"
        :to="`/surah/${surah.id}`"
        class="group hover:border-sand-500 relative flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md"
      >
        <div class="flex items-center gap-4">
          <div
            class="group-hover:bg-sand-500/10 group-hover:text-sand-600 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 font-semibold text-slate-700 transition-colors"
          >
            {{ surah.id }}
          </div>
          <div class="flex flex-col">
            <span class="group-hover:text-sand-600 font-medium text-slate-900 transition-colors">{{ surah.name_thai }}</span>
            <span class="text-xs text-slate-500">{{ surah.name_meaning_thai }}</span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="font-arabic text-lg text-slate-800">{{ surah.name_arabic }}</span>
          <span class="text-xs text-slate-400 capitalize">{{ surah.revelation_place === 'makkiyah' ? t('surah_selector.makkiyah') : t('surah_selector.madaniyah') }} · {{ t('surah_selector.ayah_count', { count: surah.verses_count }) }}</span>
        </div>
      </NuxtLink>
    </div>

    <div v-if="filteredSurahs.length === 0" class="py-12 text-center text-slate-400">
      {{ t('surah_selector.empty') }}
    </div>
  </div>
</template>
