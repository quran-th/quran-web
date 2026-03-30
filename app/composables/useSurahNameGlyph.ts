/**
 * Surah name glyph mapping for the V4 surah-name font.
 *
 * Each surah has a single glyph character in the SurahNameV4 font.
 * Bismillah uses the first 4 words of verse 1:1 (rendered through normal pipeline).
 */
import surahGlyphData from '~/data/surah-name-glyphs.json'

const surahNames: Record<string, string> = surahGlyphData.surahNames

/** Get the surah name glyph character for a given surah ID (1-114). */
export function getSurahNameGlyph(surahId: number): string {
  return surahNames[String(surahId)] ?? ''
}

/** Check if a surah has a bismillah header (all except Surah 1 Al-Fatihah and Surah 9 At-Tawbah). */
export function surahHasBismillah(surahId: number): boolean {
  return surahId !== 1 && surahId !== 9
}
