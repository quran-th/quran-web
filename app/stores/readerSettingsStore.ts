import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TranslationSource } from '~/types/source'

export const useReaderSettingsStore = defineStore('readerSettings', () => {
  const selectedSourceId = ref<number>(
    import.meta.client
      ? parseInt(localStorage.getItem('selected-source-id') ?? '1')
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
    if (translationSources.value.length > 0) return
    try {
      const res = await fetch('/api/translation-sources')
      const result = await res.json()
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
