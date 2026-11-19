/**
 * Font settings store — manages the user's Quran font preferences.
 *
 * Persisted to a cookie so the server renders the saved font; a localStorage-only
 * setting was overwritten by the SSR default on every hard load.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  QuranFont,
  type FontCategory,
  isQcfFont,
  getFontCategory,
  getQcfFontVersion,
} from '~/types/quran'

const STORAGE_KEY = 'quran-font-settings'

interface StoredSettings {
  quranFont: QuranFont
  fontScale: number
}

function loadLegacyStorage(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  }
  catch {
    return null
  }
}

export const useFontSettingsStore = defineStore('fontSettings', () => {
  const cookie = useCookie<StoredSettings | null>(STORAGE_KEY, {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  // State
  const quranFont = ref<QuranFont>(cookie.value?.quranFont ?? QuranFont.MadaniV2)
  const fontScale = ref(cookie.value?.fontScale ?? 3) // 1-10 range, 3 = default

  // ISR-cached pages hydrate with the font they were rendered with, and settings saved
  // before the cookie only exist in localStorage, so the reader's own setting is
  // reapplied once hydration is done
  if (import.meta.client) {
    onNuxtReady(() => {
      const legacy = cookie.value ? null : loadLegacyStorage()
      const own = cookie.value ?? legacy
      quranFont.value = own?.quranFont ?? QuranFont.MadaniV2
      fontScale.value = own?.fontScale ?? 3
      if (legacy) {
        persist()
        localStorage.removeItem(STORAGE_KEY)
      }
    })
  }

  // Getters
  const isQcf = computed(() => isQcfFont(quranFont.value))
  const fontCategory = computed<FontCategory>(() => getFontCategory(quranFont.value))
  const fontVersion = computed(() => getQcfFontVersion(quranFont.value))

  // Actions
  function setFont(font: QuranFont) {
    quranFont.value = font
    persist()
  }

  function setFontScale(scale: number) {
    fontScale.value = Math.max(1, Math.min(10, scale))
    persist()
  }

  function increaseFontScale() {
    setFontScale(fontScale.value + 1)
  }

  function decreaseFontScale() {
    setFontScale(fontScale.value - 1)
  }

  function persist() {
    cookie.value = {
      quranFont: quranFont.value,
      fontScale: fontScale.value,
    }
  }

  return {
    quranFont,
    fontScale,
    isQcf,
    fontCategory,
    fontVersion,
    setFont,
    setFontScale,
    increaseFontScale,
    decreaseFontScale,
  }
})
