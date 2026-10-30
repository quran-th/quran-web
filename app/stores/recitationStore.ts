import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Reciter, RecitationTimings } from '~/types/recitation'

export const DEFAULT_RECITER_ID = 7

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

interface FlatSegment {
  verseKey: string
  position: number
  start: number
  end: number
}

/**
 * Surah recitation playback with word-level highlight.
 *
 * Only the timing JSON goes through quran-api; the MP3 streams straight from
 * quranicaudio.com into a single detached <audio> element.
 *
 * The audio element, timings cache and flattened segments are kept outside
 * reactive state on purpose — long surahs have thousands of segments and the
 * rAF loop only writes the active refs when the segment actually changes.
 */
export const useRecitationStore = defineStore('recitation', () => {
  const reciterCookie = useCookie<number>('reciter-id', {
    default: () => DEFAULT_RECITER_ID,
    maxAge: 60 * 60 * 24 * 365,
  })

  const reciterId = ref<number>(reciterCookie.value)
  const reciters = ref<Reciter[]>([])
  const status = ref<PlaybackStatus>('idle')
  const chapter = ref<number | null>(null)
  const activeVerseKey = ref<string | null>(null)
  /** `${verseKey}:${position}` — single key so each word watches one ref */
  const activeWordKey = ref<string | null>(null)
  /** Chapter whose audio played through to the end; cleared on the next play */
  const completedChapter = ref<number | null>(null)

  let audio: HTMLAudioElement | null = null
  let segments: FlatSegment[] = []
  let currentTimings: RecitationTimings | null = null
  let activeIndex = -1
  let rafId = 0
  const timingsCache = new Map<string, Promise<RecitationTimings | null>>()
  // Resolved copies let playVerse start audio synchronously inside the click
  const resolvedTimings = new Map<string, RecitationTimings>()

  async function fetchReciters() {
    if (!import.meta.client || reciters.value.length > 0) return
    try {
      const result = await $fetch<{ success: boolean; data: Reciter[] }>('/api/reciters')
      if (result.success) reciters.value = result.data
    }
    catch (e) {
      console.error('Failed to fetch reciters:', e)
    }
  }

  /** Prefetch on page mount so play() can run synchronously in the click (iOS). */
  function loadTimings(chapterId: number, reciter = reciterId.value): Promise<RecitationTimings | null> {
    const key = `${reciter}:${chapterId}`
    let pending = timingsCache.get(key)
    if (!pending) {
      pending = $fetch<{ success: boolean; data: RecitationTimings }>(
        `/api/recitations/${reciter}/${chapterId}/timings`,
      )
        .then((r) => {
          if (!r.success) return null
          resolvedTimings.set(key, r.data)
          return r.data
        })
        .catch((e) => {
          console.error('Failed to fetch recitation timings:', e)
          timingsCache.delete(key)
          return null
        })
      timingsCache.set(key, pending)
    }
    return pending
  }

  function getAudio(): HTMLAudioElement {
    if (audio) return audio
    audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('playing', () => {
      status.value = 'playing'
      startTicking()
    })
    audio.addEventListener('pause', () => {
      if (status.value === 'playing') status.value = 'paused'
      stopTicking()
    })
    audio.addEventListener('ended', () => {
      const finished = chapter.value
      stop()
      completedChapter.value = finished
    })
    return audio
  }

  function applyTimings(t: RecitationTimings) {
    if (currentTimings === t) return
    currentTimings = t
    segments = t.verses
      .flatMap(v => v.segments.map(([position, start, end]) => ({ verseKey: v.verseKey, position, start, end })))
      .sort((a, b) => a.start - b.start)
    activeIndex = -1
  }

  function seek(el: HTMLAudioElement, seconds: number) {
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      el.currentTime = seconds
    }
    else {
      el.addEventListener('loadedmetadata', () => { el.currentTime = seconds }, { once: true })
    }
  }

  function startFrom(t: RecitationTimings, verseNumber: number) {
    applyTimings(t)
    const el = getAudio()
    if (el.src !== t.audioUrl) el.src = t.audioUrl

    const verse = t.verses.find(v => v.verseKey === `${t.chapter}:${verseNumber}`)
    // Word segments can begin slightly before the verse boundary
    const startMs = Math.min(verse?.from ?? 0, verse?.segments[0]?.[1] ?? Infinity)
    seek(el, startMs / 1000)

    chapter.value = t.chapter
    status.value = 'loading'
    el.play().catch(() => {
      // Autoplay blocked (iOS when timings weren't prefetched) — user can tap resume
      status.value = 'paused'
    })
  }

  async function playVerse(chapterId: number, verseNumber: number) {
    if (!import.meta.client) return
    completedChapter.value = null
    const reciter = reciterId.value
    const cached = resolvedTimings.get(`${reciter}:${chapterId}`)
    if (cached) {
      startFrom(cached, verseNumber)
      return
    }

    status.value = 'loading'
    chapter.value = chapterId
    const t = await loadTimings(chapterId, reciter)
    // Bail if the user stopped or switched surah while the fetch was in flight
    if (!t || chapter.value !== chapterId || status.value !== 'loading') {
      if (!t && chapter.value === chapterId) stop()
      return
    }
    startFrom(t, verseNumber)
  }

  function togglePause() {
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => { status.value = 'paused' })
    }
    else {
      audio.pause()
    }
  }

  function stop() {
    stopTicking()
    audio?.pause()
    status.value = 'idle'
    chapter.value = null
    activeVerseKey.value = null
    activeWordKey.value = null
    activeIndex = -1
  }

  function setReciter(id: number) {
    if (id === reciterId.value) return
    reciterId.value = id
    reciterCookie.value = id
    if (status.value === 'idle' || chapter.value === null) return

    const resumeVerse = Number(activeVerseKey.value?.split(':')[1]) || 1
    audio?.pause()
    playVerse(chapter.value, resumeVerse)
  }

  function startTicking() {
    stopTicking()
    const tick = () => {
      updateActiveWord()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function stopTicking() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  /** Binary search for the last segment that started at or before the current time. */
  function updateActiveWord() {
    if (!audio || segments.length === 0) return
    const ms = audio.currentTime * 1000

    let lo = 0
    let hi = segments.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (segments[mid]!.start <= ms) {
        found = mid
        lo = mid + 1
      }
      else {
        hi = mid - 1
      }
    }

    if (found === activeIndex) return
    activeIndex = found
    const seg = segments[found]
    activeVerseKey.value = seg?.verseKey ?? null
    activeWordKey.value = seg ? `${seg.verseKey}:${seg.position}` : null
  }

  return {
    reciterId,
    reciters,
    status,
    chapter,
    activeVerseKey,
    activeWordKey,
    completedChapter,
    fetchReciters,
    loadTimings,
    playVerse,
    togglePause,
    stop,
    setReciter,
  }
})
