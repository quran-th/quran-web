import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TranslationSource } from '~/types/source'

export const useReaderSettingsStore = defineStore('readerSettings', () => {
  const sourceCookie = useCookie<number | undefined>('selected-source-id', {
    default: () => undefined,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  const selectedSourceId = ref<number | undefined>(sourceCookie.value)
  const translationSources = ref<TranslationSource[]>([])
  /** The source the Thai translation audio reads from */
  const mukhtasarSourceId = computed(() => translationSources.value.find((s) => s.name.includes('มุคตะศ็อร'))?.id)

  function setTranslationSource(id: number | undefined) {
    selectedSourceId.value = id
    sourceCookie.value = id
  }

  async function fetchTranslationSources() {
    if (!import.meta.client) return
    if (translationSources.value.length > 0) return
    try {
      const result = await $fetch<{ success: boolean; data: TranslationSource[] }>('/api/translation-sources')
      if (result.success) {
        translationSources.value = result.data
        // Not persisted to the cookie: only an explicit user choice should stick
        if (selectedSourceId.value === undefined && mukhtasarSourceId.value !== undefined) {
          selectedSourceId.value = mukhtasarSourceId.value
        }
      }
    }
    catch (e) {
      console.error('Failed to fetch translation sources:', e)
    }
  }

  return {
    selectedSourceId,
    translationSources,
    mukhtasarSourceId,
    setTranslationSource,
    fetchTranslationSources,
  }
})
