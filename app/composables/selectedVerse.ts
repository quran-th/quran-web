import type { InjectionKey, Ref } from 'vue'

/** The verse tapped on a Mushaf page; its words take the same colour a mouse hover gives */
export const SELECTED_VERSE_KEY: InjectionKey<Readonly<Ref<string | null>>> = Symbol('selectedVerse')
