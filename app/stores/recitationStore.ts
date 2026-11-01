import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Reciter, RecitationTimings } from '~/types/recitation'

export const DEFAULT_RECITER_ID = 7
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const MAX_REPEAT = 3
export const MAX_PAUSE_SECONDS = 5

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

/** Binary search: index of the last entry <= value, or -1. */
function lastIndexAtOrBefore(sorted: number[], value: number): number {
  let lo = 0
  let hi = sorted.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! <= value) {
      found = mid
      lo = mid + 1
    }
    else {
      hi = mid - 1
    }
  }
  return found
}

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

  const cookieOpts = { maxAge: 60 * 60 * 24 * 365 }
  const speedCookie = useCookie<number>('recitation-speed', { default: () => 1, ...cookieOpts })
  const repeatCookie = useCookie<number>('recitation-repeat', { default: () => 1, ...cookieOpts })
  const pauseCookie = useCookie<number>('recitation-pause', { default: () => 0, ...cookieOpts })

  const reciterId = ref<number>(reciterCookie.value)
  const playbackRate = ref<number>(
    (PLAYBACK_SPEEDS as readonly number[]).includes(Number(speedCookie.value)) ? Number(speedCookie.value) : 1,
  )
  /** Times each ayah is played (1 = no repeat) */
  const repeatCount = ref<number>(clampInt(repeatCookie.value, 1, MAX_REPEAT))
  /** Silence after each ayah in seconds (0 = off) */
  const pauseSeconds = ref<number>(clampInt(pauseCookie.value, 0, MAX_PAUSE_SECONDS))
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
  let segmentStarts: number[] = []
  let currentTimings: RecitationTimings | null = null
  let activeIndex = -1
  let rafId = 0
  // Verse boundaries in ms; ends are contiguous so a seek never lands in a gap
  let verseKeys: string[] = []
  let verseStarts: number[] = []
  let verseEnds: number[] = []
  let verseIdx = -1
  let repeatsLeft = 0
  let gapTimer: ReturnType<typeof setTimeout> | null = null
  // rAF is throttled when the screen locks, so the verse end is also timer-driven
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null
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
    audio.defaultPlaybackRate = playbackRate.value
    audio.playbackRate = playbackRate.value
    audio.addEventListener('playing', () => {
      status.value = 'playing'
      startTicking()
      armBoundary()
    })
    audio.addEventListener('pause', () => {
      if (status.value === 'playing' && !gapTimer) status.value = 'paused'
      stopTicking()
      clearBoundary()
    })
    audio.addEventListener('ended', () => {
      // The last ayah ends with the file, so repeats must be handled here
      if (verseIdx >= 0 && repeatsLeft > 0 && applyVerseEnd()) return
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
    segmentStarts = segments.map(seg => seg.start)
    activeIndex = -1

    const verses = [...t.verses].sort((a, b) => a.from - b.from)
    verseKeys = verses.map(v => v.verseKey)
    // Word segments can begin slightly before the verse boundary
    verseStarts = verses.map(v => Math.min(v.from, v.segments[0]?.[1] ?? Infinity))
    verseEnds = verses.map((v, i) => verseStarts[i + 1] ?? v.to)
    verseIdx = -1
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
    cancelGap()
    verseIdx = -1
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
    if (gapTimer) {
      cancelGap()
      status.value = 'paused'
    }
    else if (audio.paused) {
      audio.play().catch(() => { status.value = 'paused' })
    }
    else {
      audio.pause()
    }
  }

  function stop() {
    stopTicking()
    cancelGap()
    clearBoundary()
    audio?.pause()
    status.value = 'idle'
    chapter.value = null
    activeVerseKey.value = null
    activeWordKey.value = null
    activeIndex = -1
    verseIdx = -1
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
      sync()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  function stopTicking() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function clearBoundary() {
    if (boundaryTimer) clearTimeout(boundaryTimer)
    boundaryTimer = null
  }

  function cancelGap() {
    if (gapTimer) clearTimeout(gapTimer)
    gapTimer = null
  }

  function armBoundary() {
    clearBoundary()
    if (!audio || audio.paused || verseStarts.length === 0) return
    const ms = audio.currentTime * 1000
    const idx = verseIdx >= 0 ? verseIdx : lastIndexAtOrBefore(verseStarts, ms)
    if (idx < 0) return
    const wait = Math.max(0, (verseEnds[idx]! - ms) / audio.playbackRate)
    boundaryTimer = setTimeout(sync, wait)
  }

  /**
   * Handles repeat / pause-between-ayah when the current ayah has finished.
   * Returns true when it took over playback (caller must not advance).
   */
  function applyVerseEnd(): boolean {
    if (!audio) return false
    const repeating = repeatsLeft > 0
    const isLast = verseIdx >= verseStarts.length - 1
    if (!repeating && isLast) return false

    const target = repeating ? verseStarts[verseIdx]! : verseStarts[verseIdx + 1]!
    if (!repeating && pauseSeconds.value === 0) return false
    if (repeating) {
      repeatsLeft--
    }
    else {
      verseIdx++
      repeatsLeft = repeatCount.value - 1
    }
    // Keep the finished ayah highlighted during the gap
    const enterVerse = () => { activeVerseKey.value = verseKeys[verseIdx] ?? null }

    audio.currentTime = target / 1000
    if (pauseSeconds.value > 0) {
      gapTimer = setTimeout(() => {
        gapTimer = null
        enterVerse()
        audio?.play().catch(() => { status.value = 'paused' })
      }, pauseSeconds.value * 1000)
      audio.pause()
    }
    else {
      enterVerse()
      if (audio.paused) audio.play().catch(() => { status.value = 'paused' })
      armBoundary()
    }
    return true
  }

  /** Keeps the active ayah/word in step with the audio and enforces ayah boundaries. */
  function sync() {
    if (!audio || audio.paused || verseStarts.length === 0) return
    const ms = audio.currentTime * 1000

    if (verseIdx >= 0 && ms >= verseEnds[verseIdx]! && applyVerseEnd()) return

    const idx = lastIndexAtOrBefore(verseStarts, ms)
    if (idx !== verseIdx) {
      verseIdx = idx
      repeatsLeft = repeatCount.value - 1
      activeVerseKey.value = idx >= 0 ? verseKeys[idx]! : null
      armBoundary()
    }

    if (segments.length === 0) return
    const found = lastIndexAtOrBefore(segmentStarts, ms)
    if (found === activeIndex) return
    activeIndex = found
    const seg = segments[found]
    activeWordKey.value = seg ? `${seg.verseKey}:${seg.position}` : null
  }

  function setPlaybackRate(rate: number) {
    if (!(PLAYBACK_SPEEDS as readonly number[]).includes(rate)) return
    playbackRate.value = rate
    speedCookie.value = rate
    if (audio) {
      audio.defaultPlaybackRate = rate
      audio.playbackRate = rate
      armBoundary()
    }
  }

  function setRepeatCount(n: number) {
    repeatCount.value = clampInt(n, 1, MAX_REPEAT)
    repeatCookie.value = repeatCount.value
  }

  function setPauseSeconds(n: number) {
    pauseSeconds.value = clampInt(n, 0, MAX_PAUSE_SECONDS)
    pauseCookie.value = pauseSeconds.value
  }

  return {
    reciterId,
    reciters,
    playbackRate,
    repeatCount,
    pauseSeconds,
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
    setPlaybackRate,
    setRepeatCount,
    setPauseSeconds,
  }
})
