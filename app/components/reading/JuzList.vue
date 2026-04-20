<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, computed } from 'vue'
import { useQuranStore } from '~/stores/quranStore'

const quranStore = useQuranStore()
const { juzs } = storeToRefs(quranStore)

onMounted(() => {
  if (juzs.value.length === 0) {
    quranStore.fetchJuzs()
  }
})

const juzItems = computed(() =>
  juzs.value
    .map((juz) => {
      const firstSurah = juz.surahs[0]
      const lastSurah = juz.surahs[juz.surahs.length - 1]

      if (!firstSurah || !lastSurah) return null

      return {
        ...juz,
        firstSurah,
        lastSurah,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
)
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-screen-lg mx-auto">
    <NuxtLink
      v-for="juz in juzItems"
      :key="juz.number"
      :to="`/surah/${juz.firstSurah!.id}`"
      class="group hover:border-sand-500 relative flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md"
    >
      <div class="flex items-center gap-4">
        <div
          class="group-hover:bg-sand-500/10 group-hover:text-sand-600 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 font-semibold text-slate-700 transition-colors"
        >
          {{ juz.number }}
        </div>
        <div class="flex flex-col">
          <span class="group-hover:text-sand-600 font-medium text-slate-900 transition-colors">ญุซที่ {{ juz.number }}</span>
          <span class="text-xs text-slate-500">
            {{ juz.firstSurah!.name_thai }}
            <template v-if="juz.firstSurah!.id !== juz.lastSurah!.id">
              — {{ juz.lastSurah!.name_thai }}
            </template>
          </span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span class="font-arabic text-lg text-slate-800">{{ juz.firstSurah!.name_arabic }}</span>
        <span class="text-xs text-slate-400">{{ juz.surahs.length }} ซูเราะห์ • {{ juz.verses_count }} อายะห์</span>
      </div>
    </NuxtLink>
  </div>
</template>
