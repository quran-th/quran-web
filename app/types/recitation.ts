export interface Reciter {
  id: number;
  name: string;
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
}
