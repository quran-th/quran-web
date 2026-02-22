export interface AdminSource {
  id: number;
  name: string;
  short_name: string | null;
  author: string | null;
  language: string;
  description: string | null;
  is_default: number;
  verse_count: number;
}

export interface TranslationSource {
  id: number;
  name: string;
  shortName: string | null;
  author: string | null;
  language: string;
  description: string | null;
  isDefault: number;
}
