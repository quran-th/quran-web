import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Surah } from '~/stores/quranStore'

function normalize(str: string) {
  return str.replace(/[\s-]/g, '').toLowerCase()
}

export function useSurahSearch(surahs: Ref<Surah[]>, query: Ref<string>) {
  const filteredSurahs = computed(() => {
    const raw = query.value.trim()
    const q = normalize(raw)
    if (!q) return surahs.value

    return surahs.value.filter((s: Surah) => {
      const numMatch = String(s.id).includes(q)
      const thaiMatch = normalize(s.name_thai).includes(q)
      const thaiMeaningMatch = normalize(s.name_meaning_thai ?? '').includes(q)
      const englishMatch = normalize(s.name_simple || s.englishName || '').includes(q)
      const arabicMatch = s.name_arabic.replace(/[\s-]/g, '').includes(raw.replace(/[\s-]/g, ''))
      return numMatch || thaiMatch || thaiMeaningMatch || englishMatch || arabicMatch
    })
  })

  return { filteredSurahs }
}
