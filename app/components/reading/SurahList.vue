<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import { useQuranStore } from '~/stores/quranStore'

const quranStore = useQuranStore()
const { surahs } = storeToRefs(quranStore)

onMounted(() => {
  if (surahs.value.length === 0) {
    quranStore.fetchSurahs()
  }
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    <NuxtLink
      v-for="surah in surahs"
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
          <span class="group-hover:text-sand-600 font-medium text-slate-900 transition-colors">ซูเราะห์ {{ surah.name_simple }}</span>
          <span class="text-xs text-slate-500">{{ surah.name_thai }}</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="font-arabic text-lg text-slate-800">{{ surah.name_arabic }}</span>
        <span class="text-xs text-slate-400 capitalize">{{ surah.revelation_place === 'meccan' ? 'มักกียะฮ์' : 'มะดะนียะฮ์' }} • {{ surah.verses_count }} อายะห์</span>
      </div>
    </NuxtLink>
  </div>
</template>
