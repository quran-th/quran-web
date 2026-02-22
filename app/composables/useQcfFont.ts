/**
 * Composable for dynamically loading QCF (Quran Complex Font) files.
 *
 * Ported from quran.com-frontend-next useQcfFont hook.
 * Each Quran page has its own font file (e.g. p1.woff2, p2.woff2).
 * This composable loads only the fonts needed for the currently visible verses.
 *
 * Supports multiple font versions:
 *   - v1  → King Fahd V1 (/quran/hafs/v1/)
 *   - v2  → King Fahd V2 (/quran/hafs/v2/)  [default]
 *   - v4/colrv1 → Tajweed color font (/quran/hafs/v4/colrv1/)
 */
import { ref, watch, type Ref, type ComputedRef } from 'vue'
import type { QuranWord } from '~/types/quran'

/**
 * Build the font-face name for a given page and font version.
 * e.g. page 1, version "v2" → "p1-v2"
 */
export function getFontFaceName(pageNumber: number, fontVersion: string): string {
  // Normalise version for font name: "v4/colrv1" → "v4-colrv1"
  const versionSlug = fontVersion.replace(/\//g, '-')
  return `p${pageNumber}-${versionSlug}`
}

/**
 * Build the font-face source URLs for a given page and font version.
 * Fonts are served from the CDN (assetsBaseUrl/fonts/hafs/...).
 */
function getFontFaceSource(pageNumber: number, fontVersion: string, assetsBaseUrl: string): string {
  const base = `${assetsBaseUrl}/fonts/hafs/${fontVersion}`
  const woff2 = `${base}/woff2/p${pageNumber}.woff2`
  const woff = `${base}/woff/p${pageNumber}.woff`
  const ttf = `${base}/ttf/p${pageNumber}.ttf`
  return `url('${woff2}') format('woff2'), url('${woff}') format('woff'), url('${ttf}') format('truetype')`
}

/**
 * Extract unique page numbers from an array of words.
 */
function getPageNumbers(words: QuranWord[]): number[] {
  const pages = new Set<number>()
  for (const word of words) {
    if (word.page_number) {
      pages.add(word.page_number)
    }
  }
  return Array.from(pages)
}

export function useQcfFont(
  allWords: Ref<QuranWord[]> | ComputedRef<QuranWord[]>,
  fontVersion: Ref<string> | ComputedRef<string>
) {
  const config = useRuntimeConfig()
  const assetsBaseUrl = config.public.assetsBaseUrl as string

  const loadedFonts = ref<Set<string>>(new Set())
  const currentlyLoading = ref<Set<string>>(new Set())

  function isFontLoaded(pageNumber: number): boolean {
    return loadedFonts.value.has(getFontFaceName(pageNumber, fontVersion.value))
  }

  async function loadFontForPage(pageNumber: number) {
    const version = fontVersion.value
    const fontFaceName = getFontFaceName(pageNumber, version)

    // Skip if already loaded or currently loading
    if (loadedFonts.value.has(fontFaceName) || currentlyLoading.value.has(fontFaceName)) {
      return
    }

    // Add to loading state (create new Set for reactivity)
    currentlyLoading.value = new Set(currentlyLoading.value).add(fontFaceName)

    try {
      const fontFace = new FontFace(fontFaceName, getFontFaceSource(pageNumber, version, assetsBaseUrl))
      fontFace.display = 'block'
      document.fonts.add(fontFace)
      await fontFace.load()

      // Use a new Set to trigger reactivity
      const newLoaded = new Set(loadedFonts.value)
      newLoaded.add(fontFaceName)
      loadedFonts.value = newLoaded
    }
    catch (err) {
      console.error(`Failed to load font ${fontFaceName}:`, err)
    }
    finally {
      // Remove from loading state (create new Set for reactivity)
      const newLoading = new Set(currentlyLoading.value)
      newLoading.delete(fontFaceName)
      currentlyLoading.value = newLoading
    }
  }

  // Watch for changes in words OR font version and load needed fonts
  watch(
    [allWords, fontVersion],
    ([words]) => {
      if (!import.meta.client) return
      if (words.length === 0) return

      const pages = getPageNumbers(words)
      for (const page of pages) {
        loadFontForPage(page)
      }
    },
    { immediate: true }
  )

  function isFontLoading(pageNumber: number): boolean {
    return currentlyLoading.value.has(getFontFaceName(pageNumber, fontVersion.value))
  }

  return {
    isFontLoaded,
    isFontLoading,
    loadedFonts,
  }
}
