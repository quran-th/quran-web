export interface Reciter {
  id: number;
  name: string;
  arabicName?: string;
  style: string;
  /** false = ayah-level highlight only */
  hasWordTimings: boolean;
}

/** [wordPosition, startMs, endMs] — absolute offsets in the surah audio */
export type WordSegment = [number, number, number];

export interface RecitationVerseTiming {
  verseKey: string;
  from: number;
  to: number;
  segments: WordSegment[];
}

export interface RecitationTimings {
  reciterId: number;
  chapter: number;
  audioUrl: string;
  duration: number;
  verses: RecitationVerseTiming[];
  /**
   * Measured quiet window [startMs, endMs] at each boundary verses[i] -> verses[i+1], plus a
   * final entry for the quiet after the last ayah (length verses.length). A short boundary
   * window means the ayahs are read joined. Absent until the reciter's audio has been measured.
   */
  pauses?: [number, number][];
  // Measured quiet just before ayah 1's voice; absent when unmeasured or the voice runs straight in
  head?: [number, number];
}

export interface TranslationAudio {
  set: string;
  chapter: number;
  audioUrl: string;
  durationMs: number;
  /** Absolute offsets in the surah's Thai audio */
  ayahs: { ayah: number; startMs: number; endMs: number }[];
  voice: { provider: string; model: string; voiceId: string };
}
