import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TranslationSource } from '~/types/source'

export const useReaderSettingsStore = defineStore('readerSettings', () => {
  const selectedSourceId = ref<number>(
    import.meta.client
      ? (() => {
          const stored = localStorage.getItem('selected-source-id')
          const parsed = parseInt(stored ?? '1')
          // Clear invalid values (0, NaN, negative)
          if (!parsed || parsed < 0 || isNaN(parsed)) {
            localStorage.removeItem('selected-source-id')
            return 1
          }
          return parsed
        })()
      : 1
  )
  const translationSources = ref<TranslationSource[]>([])

  function setTranslationSource(id: number) {
    selectedSourceId.value = id
    if (import.meta.client) {
      localStorage.setItem('selected-source-id', String(id))
    }
  }

  async function fetchTranslationSources() {
    if (!import.meta.client) return
    if (translationSources.value.length > 0) return
    try {
      const result = await $fetch<{ success: boolean; data: TranslationSource[] }>('/api/translation-sources')
      if (result.success) {
        translationSources.value = result.data
      }
    }
    catch (e) {
      console.error('Failed to fetch translation sources:', e)
    }
  }

  return {
    selectedSourceId,
    translationSources,
    setTranslationSource,
    fetchTranslationSources,
  }
})
