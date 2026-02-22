/**
 * Quran word and font types — ported from quran.com-frontend-next.
 *
 * Supports multiple font rendering modes:
 *   - QCF (Quran Complex Fonts): per-page glyph fonts (V1, V2, Tajweed V4)
 *   - Unicode text fonts: UthmanicHafs, IndoPak Nastaleeq
 */

// ---------------------------------------------------------------------------
// Font Constants
// ---------------------------------------------------------------------------

/**
 * Available Quran font styles.
 * Values match the word data field names from the quran.com API.
 *
 * QCF fonts (per-page glyph mapping):
 *   - MadaniV1: King Fahd V1 — uses `code_v1` field
 *   - MadaniV2: King Fahd V2 — uses `code_v2` field (default)
 *   - TajweedV4: Tajweed color font — uses `code_v2` field with v4 font files
 *
 * Unicode text fonts (single font file, plain text):
 *   - QPCHafs: QPC Uthmani Hafs — uses `qpc_uthmani_hafs` field
 *   - IndoPak: IndoPak Nastaleeq — uses `text_indopak` field
 */
export const QuranFont = {
  MadaniV1: "code_v1",
  MadaniV2: "code_v2",
  TajweedV4: "tajweed_v4",
  QPCHafs: "text_qpc_hafs",
  IndoPak: "text_indopak",
} as const;

export type QuranFont = (typeof QuranFont)[keyof typeof QuranFont];

/**
 * Number of lines per page for the IndoPak mushaf.
 *
 * NOTE: Currently only 15-line is implemented. The quran.com API also
 * supports 16-line layout (mushaf=7) using the same font and text_indopak
 * data but with different page/line assignments. If 16-line support is
 * needed later, add a separate page-index file for mushaf=7.
 */
export const MushafLines = {
  FifteenLines: "15_lines",
  // SixteenLines: "16_lines", // TODO: requires separate page-index data
} as const;

export type MushafLines = (typeof MushafLines)[keyof typeof MushafLines];

/** QCF fonts use per-page glyph codes and need dynamic font loading. */
const QCF_FONTS: QuranFont[] = [QuranFont.MadaniV1, QuranFont.MadaniV2, QuranFont.TajweedV4];

export function isQcfFont(font: QuranFont): boolean {
  return QCF_FONTS.includes(font);
}

/**
 * Map QuranFont → path segment for per-page font files.
 * Only valid for QCF fonts.
 */
export function getQcfFontVersion(font: QuranFont): string {
  switch (font) {
    case QuranFont.MadaniV1:
      return "v1";
    case QuranFont.MadaniV2:
      return "v2";
    case QuranFont.TajweedV4:
      return "v4/colrv1";
    default:
      return "v2"; // fallback
  }
}

/**
 * Font categories for the settings UI tabs.
 */
export type FontCategory = "uthmani" | "indopak" | "tajweed";

export function getFontCategory(font: QuranFont): FontCategory {
  switch (font) {
    case QuranFont.MadaniV1:
    case QuranFont.MadaniV2:
    case QuranFont.QPCHafs:
      return "uthmani";
    case QuranFont.IndoPak:
      return "indopak";
    case QuranFont.TajweedV4:
      return "tajweed";
    default:
      return "uthmani";
  }
}

// ---------------------------------------------------------------------------
// Word / Verse types
// ---------------------------------------------------------------------------

export type CharType = "word" | "end" | "pause";

/**
 * A single word from the quran.com API.
 *
 * Multi-font fields are optional — the data enrichment script adds them.
 * At minimum, `code_v2` and `text_uthmani` are always present.
 */
export interface QuranWord {
  id?: number;
  position: number;
  char_type_name: CharType;

  // QCF glyph codes (per-page font mapping)
  code_v2: string;
  code_v1?: string; // added by enrichment script

  // Unicode text variants
  text_uthmani: string;
  text_qpc_hafs?: string; // QPC Uthmani Hafs text
  text_indopak?: string; // added by enrichment script

  page_number: number;
  line_number: number;
  text?: string;
  verse_key?: string;
  verse_number?: number;
}

/**
 * Get the display text for a word based on the active font.
 * Falls back to text_uthmani if the requested field is missing.
 */
export function getWordTextField(word: QuranWord, font: QuranFont): string {
  switch (font) {
    case QuranFont.MadaniV1:
      return word.code_v1 ?? word.text_uthmani;
    case QuranFont.MadaniV2:
    case QuranFont.TajweedV4: // Tajweed uses code_v2 glyphs with color font files
      return word.code_v2;
    case QuranFont.QPCHafs:
      return word.text_qpc_hafs ?? word.text_uthmani;
    case QuranFont.IndoPak:
      return word.text_indopak ?? word.text_uthmani;
    default:
      return word.code_v2;
  }
}

/**
 * A verse with word-level data for QCF rendering.
 */
export interface QuranVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  page_number: number;
  words: QuranWord[];
}

// ---------------------------------------------------------------------------
// quran-words/{chapterId}.json file types
// ---------------------------------------------------------------------------

/** A single word entry as stored in quran-words/*.json */
export interface QuranWordEntry {
  position: number;
  char_type_name: CharType;
  code_v1: string;
  code_v2: string;
  text_uthmani: string;
  text_qpc_hafs: string;
  text_indopak: string;
  page_number: number;
  line_number: number;
}

/** A verse entry as stored in quran-words/*.json */
export interface QuranVerseEntry {
  verse_number: number;
  verse_key: string;
  page_number: number;
  words: QuranWordEntry[];
}

/** The shape of a quran-words/{chapterId}.json file */
export type QuranWordFile = QuranVerseEntry[];
