<script setup lang="ts">
/**
 * GlyphWord — renders a single QCF glyph character.
 *
 * Supports multiple QCF font versions:
 *   - v1 (King Fahd V1) — uses `code_v1` data
 *   - v2 (King Fahd V2) — uses `code_v2` data [default]
 *   - v4/colrv1 (Tajweed) — uses `code_v2` data with color font files
 *
 * When the per-page font is loaded, displays the glyph via fontFamily.
 * While loading, hides the glyph (opacity: 0).
 */
import { computed } from 'vue'
import { getFontFaceName } from '~/composables/useQcfFont'

interface Props {
  /** The glyph code to render (either code_v1 or code_v2) */
  glyphCode: string
  pageNumber: number
  fontVersion: string
  isFontLoaded: boolean
}

const props = defineProps<Props>()

const fontStyle = computed(() => {
  if (!props.isFontLoaded) return {}
  return { fontFamily: getFontFaceName(props.pageNumber, props.fontVersion) }
})

/** Decode HTML entities (e.g., "&#65152;" → actual character) for safe rendering */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

const decodedGlyph = computed(() => decodeHtmlEntities(props.glyphCode))
</script>

<template>
  <span
    class="glyph-word"
    :class="{ 'glyph-loading': !isFontLoaded }"
    :style="fontStyle"
  >{{ decodedGlyph }}</span>
</template>

<style scoped>
.glyph-word {
  line-height: var(--mushaf-line-height, normal);
  font-size: inherit;
}

.glyph-loading {
  opacity: 0;
}
</style>
