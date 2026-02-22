/**
 * Font settings store — manages the user's Quran font preferences.
 *
 * Persisted to localStorage so settings survive page refreshes.
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

function loadFromStorage(): StoredSettings | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  }
  catch {
    return null
  }
}

function saveToStorage(settings: StoredSettings) {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useFontSettingsStore = defineStore('fontSettings', () => {
  const saved = loadFromStorage()

  // State
  const quranFont = ref<QuranFont>(saved?.quranFont ?? QuranFont.MadaniV2)
  const fontScale = ref(saved?.fontScale ?? 3) // 1-5 range, 3 = default

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
    fontScale.value = Math.max(1, Math.min(5, scale))
    persist()
  }

  function increaseFontScale() {
    setFontScale(fontScale.value + 1)
  }

  function decreaseFontScale() {
    setFontScale(fontScale.value - 1)
  }

  function persist() {
    saveToStorage({
      quranFont: quranFont.value,
      fontScale: fontScale.value,
    })
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
