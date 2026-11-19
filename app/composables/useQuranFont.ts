import { computed, inject, provide, type InjectionKey } from 'vue'
import { storeToRefs } from 'pinia'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { QuranFont, getQcfFontVersion, isQcfFont } from '~/types/quran'

const LOCKED_FONT_KEY: InjectionKey<QuranFont> = Symbol('lockedQuranFont')

/** The Mushaf page layout follows the 15-line V2 page grid, so every word under it renders in this font */
export const MUSHAF_LOCKED_FONT = QuranFont.MadaniV2

/** Renders this component's subtree in `font`, leaving the saved setting untouched for every other view */
export function provideLockedQuranFont(font: QuranFont) {
  provide(LOCKED_FONT_KEY, font)
}

/** The font words should render in here: a locked font from an ancestor, otherwise the user's setting */
export function useQuranFont() {
  const locked = inject(LOCKED_FONT_KEY, null)
  const { quranFont: savedFont } = storeToRefs(useFontSettingsStore())
  const quranFont = computed(() => locked ?? savedFont.value)
  return {
    quranFont,
    isQcf: computed(() => isQcfFont(quranFont.value)),
    fontVersion: computed(() => getQcfFontVersion(quranFont.value)),
  }
}
