import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Reciter, RecitationTimings, TranslationAudio, TranslationAudioPart } from '~/types/recitation'
import { getReciterLabelTh } from '~/data/reciter-names-th'
import { useQuranStore } from '~/stores/quranStore'

export const DEFAULT_RECITER_ID = 7
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const MAX_REPEAT = 3
export const MAX_PAUSE_SECONDS = 5
export const TRANSLATION_ARTIST = 'คำแปลอัล-มุคตะศ็อร (เสียง AI)'
// Slack on top of the clip length before a stalled Thai element is abandoned
const TRANSLATION_STALL_MS = 5000
// Thai clips are regenerated often under the same file names (only `?v` changes), so metadata older
// than the API's own cache lifetime is refetched before it starts playback
const TRANSLATION_MAX_AGE_MS = 5 * 60 * 1000
const TRANSLATION_REFETCH_TIMEOUT_MS = 8000
// A failed refetch is retried this soon (the old metadata stays in use meanwhile)
const TRANSLATION_RETRY_MS = 30_000
// A part whose length in the browser differs from its metadata by more than this makes the metadata
// suspect. Browsers measure mp3s differently from ffprobe (encoder delay and padding ~50 ms, Safari
// estimating from the bitrate), so the call is made on the URL after a refetch, not on this number
const PART_LENGTH_TOLERANCE_MS = 300
// When that refetch fails, Thai is skipped only if the file is this far off: clearly misaligned
const PART_LENGTH_BROKEN_MS = 1000
// A clip waiting for that refetch plays anyway after this long
const THAI_HOLD_MAX_MS = 1500
// The reader's notice stays at least this long, and hides itself after the second
const ISSUE_MIN_MS = 4000
const ISSUE_MAX_MS = 8000
// An ayah is stopped this far before the next ayah's `from`, inside the pause between them.
// `from` sits 0–100 ms before the next sound in word-timed (QDC) files and up to ~180 ms
// after it in some mp3quran files, while the quiet tail before `from` is ≥ 60 ms in QDC files
// and ~400 ms in mp3quran files (their `from` is the previous sound end + 400 ms). A late
// pause() (timers on a locked screen, output latency) then spills into silence, not speech.
const BOUNDARY_LEAD_MS = { word: 80, ayah: 250 }
// When the reciter's audio has been measured (timings.pauses), the stop goes inside the real
// pause instead: this long after the sound ends, but with a guard before the next sound so a
// late pause() never clips it. A quiet window under MIN_PAUSE_MS means the reciter joins the two
// ayahs in one breath (waṣl): no stop there, the Thai clips of the whole run follow its real stop.
const MIN_PAUSE_MS = 300
const STOP_AFTER_SOUND_MS = 200
const RESUME_GUARD_MS = 100
// After a real stop the Arabic resumes this long before the next ayah's voice: a play() after the
// Thai clip can drop its first ~100-250 ms on phones, which swallowed soft first letters (و, ف)
const RESUME_LEAD_MS = 400
// Ayah 1 starts this long before its voice, inside the measured quiet before it (timings.head):
// mp3quran puts `from` up to ~500 ms after the voice starts, and a cold play() can drop its first
// instant. Without a measurement it starts this long before `from`.
const FIRST_AYAH_LEAD_MS = 300
// Soft endings (س, ه, a held نّ) fade under the quiet threshold, so the last ayah plays through a
// short quiet after it (up to where the next sound or the file end begins), or this far into a long one
const LAST_AYAH_TAIL_MS = 800
const LAST_AYAH_SHORT_QUIET_MS = 2000
// A resume or primed Thai seek within this distance is skipped: it is already in place
const SEEK_SLACK_MS = 40
// An element still paused this long after play() was refused by the OS (see playElement)
const PLAY_START_TIMEOUT_MS = 1000
const LAST_CHAPTER = 114

export type TranslationAudioSetting = 'off' | 'mukhtasar'
export type PlaybackPhase = 'arabic' | 'translation'

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

type ThaiAudio = TranslationAudio & { parts: TranslationAudioPart[]; partByIndex: Map<number, TranslationAudioPart> }

/** Responses from before the split have no `parts`: their single file is one part starting at 0. */
function withParts(t: TranslationAudio): ThaiAudio | null {
  let parts = t.parts
  if (!parts?.length) {
    if (!t.audioUrl) return null
    parts = [{
      index: 0,
      audioUrl: t.audioUrl,
      startMs: 0,
      durationMs: t.durationMs,
      firstAyah: t.ayahs[0]?.ayah ?? 1,
      lastAyah: t.ayahs.at(-1)?.ayah ?? 1,
    }]
  }
  return { ...t, parts, partByIndex: new Map(parts.map(p => [p.index, p])) }
}

/** File of the part holding `ayah`, or of the first part. */
function partUrl(t: ThaiAudio, ayah: number): string | undefined {
  const entry = t.ayahs.find(a => a.ayah === ayah)
  return (t.partByIndex.get(entry?.part ?? 0) ?? t.parts[0])?.audioUrl
}

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

interface FlatSegment {
  verseKey: string
  position: number
  start: number
  end: number
}

interface ThaiClip {
  verseKey: string
  /** The clip's part file; startMs/endMs are offsets inside it */
  url: string
  startMs: number
  endMs: number
  /** The part holds only this ayah, so it plays whole and its offsets cannot go stale */
  soloPart: boolean
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
  const translationAudioCookie = useCookie<TranslationAudioSetting>('recitation-translation-audio', {
    default: () => 'off',
    ...cookieOpts,
  })
  const translationAudioEnabled = !!useRuntimeConfig().public.translationAudio

  const reciterId = ref<number>(reciterCookie.value)
  const playbackRate = ref<number>(
    (PLAYBACK_SPEEDS as readonly number[]).includes(Number(speedCookie.value)) ? Number(speedCookie.value) : 1,
  )
  /** Times each ayah is played (1 = no repeat) */
  const repeatCount = ref<number>(clampInt(repeatCookie.value, 1, MAX_REPEAT))
  /** Silence after each ayah in seconds (0 = off) */
  const pauseSeconds = ref<number>(clampInt(pauseCookie.value, 0, MAX_PAUSE_SECONDS))
  /** Thai reading played after each ayah; always 'off' while the feature flag is off */
  const translationAudio = ref<TranslationAudioSetting>(
    translationAudioEnabled && translationAudioCookie.value === 'mukhtasar' ? 'mukhtasar' : 'off',
  )
  const reciters = ref<Reciter[]>([])
  const status = ref<PlaybackStatus>('idle')
  const chapter = ref<number | null>(null)
  const activeVerseKey = ref<string | null>(null)
  /** `${verseKey}:${position}` — single key so each word watches one ref */
  const activeWordKey = ref<string | null>(null)
  /** Chapter whose audio played through to the end; cleared on the next play */
  const completedChapter = ref<number | null>(null)
  /** Points out the playing ayah's report flag; set once, right after Thai audio is enabled from the promo */
  const reportHint = ref(false)
  /** 'translation' while the Thai clip of the current ayah plays; the Arabic element is paused then */
  const phase = ref<PlaybackPhase>('arabic')

  let audio: HTMLAudioElement | null = null
  let segments: FlatSegment[] = []
  let segmentStarts: number[] = []
  let currentTimings: RecitationTimings | null = null
  let activeIndex = -1
  let rafId = 0
  // Verse boundaries in ms; contiguous (starts[i+1] === ends[i]) so a seek never lands in a gap
  let verseKeys: string[] = []
  let verseStarts: number[] = []
  let verseEnds: number[] = []
  // joined[i]: verse i runs straight into i+1 with no stop; its end only moves the highlight
  let joined: boolean[] = []
  let verseIdx = -1
  // First verse of the breath group being played; repeats and the Thai clips cover runStart..verseIdx
  let runStart = -1
  let repeatsLeft = 0
  let gapTimer: ReturnType<typeof setTimeout> | null = null
  // rAF is throttled when the screen locks, so the verse end is also timer-driven
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null
  let thaiAudio: HTMLAudioElement | null = null
  // Never played: loads the part file a back-to-back Thai clip will switch to, so the switch is quick
  let thaiWarm: HTMLAudioElement | null = null
  let thaiUnlocked = false
  let thaiEndMs = 0
  let thaiTimer: ReturnType<typeof setTimeout> | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  // Playback the OS stopped while the user meant to keep listening; picked up when the page is visible again
  let resumeOnVisible = false
  // Clips still to play after the current one (one per ayah of the run)
  let thaiQueue: ThaiClip[] = []
  let thaiCurrent: ThaiClip | null = null
  // Clip at the head of thaiQueue waiting for fresh metadata before it starts (its offsets may be stale)
  let thaiHeld: ThaiClip | null = null
  const translationCache = new Map<number, Promise<ThaiAudio | null>>()
  // null = chapter has no Thai audio
  const resolvedTranslations = new Map<number, ThaiAudio | null>()
  const translationFetchedAt = new Map<number, number>()
  const translationRequests = new Map<number, Promise<ThaiAudio | null>>()
  // Chapters whose last refetch failed
  const refreshFailed = new Set<number>()
  // Last length-mismatch refetch per chapter (see forceRefetch)
  const forcedRefetchAt = new Map<number, number>()
  // Part URLs whose length did not match, until the refetch settles them
  const suspectParts = new Map<string, { chapter: number; measuredMs: number; expectedMs: number; loadedAt: number }>()
  // Same URL in fresh metadata: the difference is how this browser measures, not checked again
  const trustedParts = new Set<string>()
  // Refetch failed and the file is clearly off: skipped until a refetch succeeds (url → chapter)
  const brokenParts = new Map<string, number>()
  // When each element last started loading a file: only metadata fetched after that can vouch for it
  const loadStartedAt = new WeakMap<HTMLAudioElement, number>()
  /** Thai was skipped because its audio failed to load or play; cleared when Thai plays again */
  const translationAudioIssue = ref(false)
  let issueChapter: number | null = null
  let issueShownAt = 0
  let issueTimer: ReturnType<typeof setTimeout> | null = null
  /** Reactive mirror of resolvedTranslations: whether a chapter has Thai audio, once known */
  const translationAvailability = ref<Record<number, boolean>>({})
  const currentChapterHasTranslation = computed(() =>
    chapter.value !== null && translationAvailability.value[chapter.value] === true,
  )
  const timingsCache = new Map<string, Promise<RecitationTimings | null>>()
  // Resolved copies let playVerse start audio synchronously inside the click
  const resolvedTimings = new Map<string, RecitationTimings>()

  async function fetchReciters() {
    if (!import.meta.client || reciters.value.length > 0) return
    try {
      const result = await $fetch<{ success: boolean; data: Reciter[] }>('/api/reciters?v=2')
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
      // v=2: response gained `pauses`; busts the 7-day browser cache of the old shape
      pending = $fetch<{ success: boolean; data: RecitationTimings }>(
        `/api/recitations/${reciter}/${chapterId}/timings?v=4`,
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

  /** Prefetch alongside timings so the Thai element can be unlocked inside the click. */
  function loadTranslation(chapterId: number): Promise<ThaiAudio | null> {
    if (translationAudio.value === 'off') return Promise.resolve(null)
    return fetchTranslation(chapterId)
  }

  /** Cached metadata, refetched once older than TRANSLATION_MAX_AGE_MS (or when `force`d). */
  function fetchTranslation(chapterId: number, force = false): Promise<ThaiAudio | null> {
    if (!translationAudioEnabled) return Promise.resolve(null)
    const inFlight = translationRequests.get(chapterId)
    if (inFlight) return inFlight
    const cached = translationCache.get(chapterId)
    if (cached && !force && Date.now() - (translationFetchedAt.get(chapterId) ?? 0) <= TRANSLATION_MAX_AGE_MS) return cached
    const refresh = resolvedTranslations.has(chapterId)
    const startedAt = Date.now()
    translationFetchedAt.set(chapterId, startedAt)
    const settle = (data: ThaiAudio | null, failed: boolean) => {
      translationRequests.delete(chapterId)
      if (refresh) applyFreshTranslation(chapterId, failed, startedAt)
      return data
    }
    // no-cache: the browser revalidates its HTTP copy, so the metadata is never older than the max age
    const pending = $fetch<{ success: boolean; data: TranslationAudio }>(`/api/translation-audio/${chapterId}`, {
      cache: 'no-cache',
      timeout: TRANSLATION_REFETCH_TIMEOUT_MS,
    })
      .then((r) => {
        const data = r.success ? withParts(r.data) : null
        resolvedTranslations.set(chapterId, data)
        translationAvailability.value = { ...translationAvailability.value, [chapterId]: !!data }
        refreshFailed.delete(chapterId)
        return settle(data, false)
      })
      .catch((e) => {
        if (e?.statusCode === 404) {
          resolvedTranslations.set(chapterId, null)
          translationAvailability.value = { ...translationAvailability.value, [chapterId]: false }
          refreshFailed.delete(chapterId)
          return settle(null, false)
        }
        console.error('Failed to fetch translation audio:', e)
        refreshFailed.add(chapterId)
        // Retried this soon, not on every call; the old metadata, if any, stays in use meanwhile
        translationFetchedAt.set(chapterId, Date.now() - TRANSLATION_MAX_AGE_MS + TRANSLATION_RETRY_MS)
        return settle(resolvedTranslations.get(chapterId) ?? null, true)
      })
    translationRequests.set(chapterId, pending)
    translationCache.set(chapterId, pending)
    return pending
  }

  /** One length-mismatch refetch per chapter per TRANSLATION_MAX_AGE_MS: no refetch loops. */
  function forceRefetch(chapterId: number): boolean {
    // One in flight may predate the file's load: its settle asks again if so (applyFreshTranslation)
    if (translationRequests.has(chapterId)) return false
    const last = forcedRefetchAt.get(chapterId)
    if (last !== undefined && Date.now() - last <= TRANSLATION_MAX_AGE_MS) return false
    forcedRefetchAt.set(chapterId, Date.now())
    fetchTranslation(chapterId, true)
    return true
  }

  /**
   * Settles the parts whose length did not match, then hands fresh metadata to the idle Thai
   * element (re-prime) or to the clips still queued; never to the clip that is playing.
   */
  function applyFreshTranslation(chapterId: number, failed: boolean, fetchStartedAt: number) {
    const urls = new Set(resolvedTranslations.get(chapterId)?.parts.map(p => p.audioUrl))
    let askedAgain = false
    for (const [url, s] of suspectParts) {
      if (s.chapter !== chapterId) continue
      // Same URL in metadata fetched before the file started loading proves nothing: ask again
      if (!failed && urls.has(url) && fetchStartedAt < s.loadedAt) {
        askedAgain ||= forceRefetch(chapterId)
        if (askedAgain) continue
      }
      suspectParts.delete(url)
      // A new `?v` for that part means the old metadata was stale: the fresh clips play the new file
      if (!urls.has(url)) continue
      // Same URL: the metadata is current and the difference is how this browser measures the file
      if (!failed) {
        if (fetchStartedAt >= s.loadedAt) trustedParts.add(url)
      }
      else if (Math.abs(s.measuredMs - s.expectedMs) > PART_LENGTH_BROKEN_MS) brokenParts.set(url, chapterId)
    }
    // A file only judged broken because a refetch failed is vouched for by one that succeeded
    if (!failed) {
      for (const [url, c] of brokenParts) {
        if (c !== chapterId || !urls.has(url)) continue
        brokenParts.delete(url)
        trustedParts.add(url)
      }
    }
    if (chapterId !== chapter.value) return
    if (phase.value === 'arabic') {
      primeTranslation()
      return
    }
    // thaiHeld, if any, is still at the head of the queue and is rebuilt with it
    thaiQueue = thaiClips(thaiQueue.map(c => c.verseKey)) ?? []
    warmThai(thaiQueue[0]?.url)
    // Paused meanwhile: thaiHeld stays set, so resume() restarts through nextThaiClip
    if (thaiHeld && status.value === 'playing') nextThaiClip()
  }

  /** A part's file length against its metadata, on loadedmetadata of the Thai or the warm element. */
  function checkPartLength(el: HTMLAudioElement) {
    const c = chapter.value
    const url = el.src
    if (c === null || trustedParts.has(url) || suspectParts.has(url) || brokenParts.has(url)) return
    const t = resolvedTranslations.get(c)
    const part = t?.parts.find(p => p.audioUrl === url)
    const measuredMs = el.duration * 1000
    if (!part || !Number.isFinite(measuredMs) || Math.abs(measuredMs - part.durationMs) <= PART_LENGTH_TOLERANCE_MS) return
    suspectParts.set(url, { chapter: c, measuredMs, expectedMs: part.durationMs, loadedAt: loadStartedAt.get(el) ?? Date.now() })
    // Already refetched just now: settle it on that result (it may predate this file's load)
    if (!forceRefetch(c) && !translationRequests.has(c)) applyFreshTranslation(c, refreshFailed.has(c), 0)
    // The clip this element just loaded must not start on offsets that may be stale
    const current = thaiCurrent
    const unsettled = suspectParts.has(url) || brokenParts.has(url)
    if (unsettled && current && !current.soloPart && el === thaiAudio && phase.value === 'translation'
      && current.url === url && !thaiHeld) {
      thaiQueue.unshift(current)
      nextThaiClip()
    }
  }

  function reportTranslationIssue() {
    // Once per chapter, so a run of broken ayahs does not flash it on and off
    if (issueChapter === chapter.value) return
    issueChapter = chapter.value
    issueShownAt = Date.now()
    translationAudioIssue.value = true
    hideTranslationIssue(ISSUE_MAX_MS)
  }

  function hideTranslationIssue(afterMs: number) {
    if (issueTimer) clearTimeout(issueTimer)
    issueTimer = setTimeout(() => {
      issueTimer = null
      translationAudioIssue.value = false
    }, afterMs)
  }

  /** Thai plays again: the notice goes, once it has been readable for ISSUE_MIN_MS. */
  function settleTranslationIssue() {
    if (!translationAudioIssue.value) return
    hideTranslationIssue(Math.max(0, issueShownAt + ISSUE_MIN_MS - Date.now()))
  }

  function resetTranslationIssue() {
    if (issueTimer) clearTimeout(issueTimer)
    issueTimer = null
    translationAudioIssue.value = false
    issueChapter = null
  }

  function getAudio(): HTMLAudioElement {
    if (audio) return audio
    audio = new Audio()
    audio.preload = 'auto'
    audio.defaultPlaybackRate = playbackRate.value
    audio.playbackRate = playbackRate.value
    registerMediaSessionActions()
    document.addEventListener('visibilitychange', onVisibilityChange)
    audio.addEventListener('playing', () => {
      // Only the active element may play: iOS restarts whatever it interrupted (call, route change)
      if (phase.value === 'translation') {
        audio?.pause()
        return
      }
      status.value = 'playing'
      startTicking()
      armBoundary()
    })
    audio.addEventListener('pause', () => {
      if (status.value === 'playing' && !gapTimer && phase.value === 'arabic') status.value = 'paused'
      stopTicking()
      clearBoundary()
    })
    audio.addEventListener('ended', () => {
      if (phase.value === 'translation') return
      // The last ayah ends with the file, so repeats and its Thai clips must be handled here
      if (verseIdx >= 0 && (repeatsLeft > 0 || thaiForRun(runStart, verseIdx, true)) && applyVerseEnd()) return
      completeChapter()
    })
    return audio
  }

  function getThaiAudio(): HTMLAudioElement {
    if (thaiAudio) return thaiAudio
    const el = new Audio()
    thaiAudio = el
    el.preload = 'auto'
    el.defaultPlaybackRate = playbackRate.value
    el.playbackRate = playbackRate.value
    el.addEventListener('playing', () => {
      // Held: an element iOS restarts by itself must not play on past the hold (see holdThaiClip)
      if (phase.value !== 'translation' || thaiHeld) {
        el.pause()
        return
      }
      status.value = 'playing'
      settleTranslationIssue()
      armThaiEnd()
    })
    el.addEventListener('pause', () => {
      // A clip ending with its part file pauses the element just before 'ended' moves on; a pause
      // the src switch to the next part may report arrives after play() already restarted it; and a
      // held clip pauses the element while the reading goes on
      if (phase.value !== 'translation' || el.ended || !el.paused || thaiHeld) return
      if (status.value === 'playing') status.value = 'paused'
      clearThaiTimer()
    })
    el.addEventListener('timeupdate', () => {
      // Below HAVE_METADATA the element is switching parts and currentTime is not the new clip's yet
      if (phase.value === 'translation' && !thaiHeld && !el.seeking && el.readyState >= HTMLMediaElement.HAVE_METADATA
        && el.currentTime * 1000 >= thaiEndMs) nextThaiClip()
    })
    // The end timer or timeupdate may already have switched to the next part: that file has not ended
    el.addEventListener('ended', () => {
      if (el.ended) nextThaiClip()
    })
    el.addEventListener('loadstart', () => loadStartedAt.set(el, Date.now()))
    el.addEventListener('loadedmetadata', () => checkPartLength(el))
    // Retried on the next clip: prime and nextThaiClip reload an element in error
    el.addEventListener('error', () => {
      if (phase.value !== 'translation') return
      console.error('Translation audio failed to play')
      reportTranslationIssue()
      finishTranslation()
    })
    return el
  }

  function clearThaiTimer() {
    if (thaiTimer) clearTimeout(thaiTimer)
    thaiTimer = null
  }

  /** A clip that started but never reaches its end must not stall the reading. */
  function armThaiStall(el: HTMLAudioElement, clipMs: number) {
    thaiTimer = setTimeout(() => {
      if (el.paused) return
      reportTranslationIssue()
      nextThaiClip()
    }, clipMs / el.playbackRate + TRANSLATION_STALL_MS)
  }

  // Timer-driven like armBoundary: timeupdate and rAF are throttled on a locked screen
  function armThaiEnd() {
    // The timer is the hold's own while a clip is held
    if (thaiHeld) return
    clearThaiTimer()
    if (!thaiAudio || thaiAudio.paused) return
    const remaining = thaiEndMs - thaiAudio.currentTime * 1000
    // The audio clock trails the timer by tens of ms: re-check until the clip end is really reached
    const wait = remaining / thaiAudio.playbackRate
    thaiTimer = remaining > SEEK_SLACK_MS ? setTimeout(armThaiEnd, Math.max(50, wait)) : setTimeout(nextThaiClip, Math.max(0, wait))
  }

  /** Thai clips for these verses from the current metadata (ayahs without a clip are skipped), or null if none. */
  function thaiClips(keys: string[]): ThaiClip[] | null {
    if (translationAudio.value === 'off' || chapter.value === null) return null
    const t = resolvedTranslations.get(chapter.value)
    if (!t) return null
    const clips: ThaiClip[] = []
    for (const verseKey of keys) {
      const entry = t.ayahs.find(a => a.ayah === Number(verseKey.split(':')[1]))
      const part = entry && t.partByIndex.get(entry.part ?? 0)
      if (!entry || !part) continue
      // A one-ayah part's file can run a few ms past endMs (encoder padding): the end timer hands
      // over while it still plays, as with a whole-surah file, and 'ended' only backs it up
      clips.push({
        verseKey,
        url: part.audioUrl,
        startMs: entry.startMs - part.startMs,
        endMs: entry.endMs - part.startMs,
        soloPart: part.firstAyah === part.lastAyah,
      })
    }
    return clips.length > 0 ? clips : null
  }

  /**
   * Thai clips for verses start..end, or null if none. With `report` (a run about to start) clips
   * that cannot play are left out and the reader is told: broken parts, and the file the prime's
   * reload left in error, so the Arabic goes on instead of pausing for a clip that fails at once.
   */
  function thaiForRun(start: number, end: number, report = false): ThaiClip[] | null {
    const clips = thaiClips(verseKeys.slice(Math.max(0, start), end + 1)) ?? []
    const failed = report && thaiAudio?.error ? thaiAudio.src : null
    const playable = clips.filter(c => !brokenParts.has(c.url) && c.url !== failed)
    if (report && playable.length < clips.length) reportTranslationIssue()
    return playable.length > 0 ? playable : null
  }

  /** Starts loading a part file ahead of a switch to it; never more than one at a time. */
  function warmThai(url: string | undefined) {
    if (!url || thaiAudio?.src === url || thaiWarm?.src === url) return
    if (!thaiWarm) {
      const el = new Audio()
      el.preload = 'auto'
      el.addEventListener('loadstart', () => loadStartedAt.set(el, Date.now()))
      el.addEventListener('loadedmetadata', () => checkPartLength(el))
      thaiWarm = el
    }
    thaiWarm.src = url
  }

  function releaseWarm() {
    if (!thaiWarm?.src) return
    thaiWarm.removeAttribute('src')
    thaiWarm.load()
  }

  /**
   * Seeks the idle Thai element to the clip that will play first after the current run,
   * while the Arabic still plays, so play() at the boundary starts at once instead of
   * seeking first (which eats the first tens of ms on iOS).
   */
  function primeTranslation() {
    if (phase.value !== 'arabic') return
    // Keeps a long session on fresh metadata; it reaches the clips at the next prime or run
    if (chapter.value !== null) loadTranslation(chapter.value)
    // A joined next ayah's clip follows this one back to back, maybe from another part
    const clips = thaiForRun(runStart, joined[runStart] ? runStart + 1 : runStart)
    if (!clips) return
    const el = getThaiAudio()
    const first = clips[0]!
    // An element in error is reloaded: a failed file is retried on the next ayah
    if (el.src !== first.url || el.error) el.src = first.url
    seekTo(el, first.startMs)
    warmThai(clips[1]?.url)
  }

  function startTranslation(clips: ThaiClip[]) {
    if (!audio) return
    phase.value = 'translation'
    // 'ended' pauses the element before this runs; playing stays the intent
    status.value = 'playing'
    thaiQueue = [...clips]
    // Thai play() before the Arabic pause(): a background page is only allowed to start an element
    // while it is still playing one (the OS audio session stays active, see playElement); the Arabic
    // is inside the silence between ayahs here, so the few ms of overlap are inaudible
    nextThaiClip()
    audio.pause()
  }

  /**
   * Plays the next queued clip (highlight follows it); resumes the Arabic when the queue is empty.
   * `waited`: a held clip plays now, without waiting for fresh metadata any longer.
   */
  function nextThaiClip(waited = false) {
    if (phase.value !== 'translation') return
    thaiHeld = null
    let clip = thaiQueue.shift()
    while (clip && brokenParts.has(clip.url)) {
      reportTranslationIssue()
      clip = thaiQueue.shift()
    }
    if (!clip) {
      finishTranslation()
      return
    }
    // Its file did not match the metadata and fresh metadata is on its way. Only offsets inside a
    // multi-ayah file can be stale (a one-ayah part plays whole). A hidden page plays it anyway: it
    // may not restart the element after waiting (see playElement).
    if (!waited && suspectParts.has(clip.url) && !clip.soloPart && chapter.value !== null
      && translationRequests.has(chapter.value) && !document.hidden) {
      holdThaiClip(clip)
      return
    }
    thaiCurrent = clip
    const el = getThaiAudio()
    // Whole-ayah highlight while its Thai plays: no single word is being read
    activeVerseKey.value = clip.verseKey
    activeWordKey.value = null
    activeIndex = -1
    // Still playing from the previous clip, which this one follows in the same file: no seek, and
    // no 'playing' event will arm the end
    const follows = !el.paused && el.src === clip.url && Math.abs(clip.startMs - thaiEndMs) <= SEEK_SLACK_MS
    thaiEndMs = clip.endMs
    clearThaiTimer()
    if (follows) {
      armThaiEnd()
      warmThai(thaiQueue[0]?.url)
      return
    }
    // A clip in another part than the one just played is switched to and restarted in this same task
    // (the end timer, or the previous part's 'ended' event), so a locked screen never has a moment with
    // no element playing, as in completeChapter. The pause, timeupdate and ended handlers ignore what
    // the switch fires.
    const switched = el.src !== clip.url || !!el.error
    if (switched) el.src = clip.url
    warmThai(thaiQueue[0]?.url)
    // Seeking a playing element fires no 'playing' to arm the end
    if (seekTo(el, clip.startMs) && !switched && !el.paused) el.addEventListener('seeked', armThaiEnd, { once: true })
    // A clip that never started was refused by the OS and is left to playElement, which shows it as paused
    armThaiStall(el, clip.endMs - clip.startMs)
    playElement(el)
  }

  /**
   * Pauses the Thai element on `clip` until applyFreshTranslation rebuilds the queue and goes on, or
   * THAI_HOLD_MAX_MS passes and it plays as it is. resume() and a return to the page restart a held
   * clip through nextThaiClip, never by playing the paused element.
   */
  function holdThaiClip(clip: ThaiClip) {
    thaiHeld = clip
    thaiQueue.unshift(clip)
    clearThaiTimer()
    clearStartTimer()
    thaiAudio?.pause()
    thaiTimer = setTimeout(() => {
      thaiTimer = null
      if (thaiHeld === clip && status.value === 'playing') nextThaiClip(true)
    }, THAI_HOLD_MAX_MS)
  }

  /** Stops the Thai clips without resuming Arabic. */
  function cancelTranslation() {
    clearThaiTimer()
    thaiQueue = []
    thaiHeld = null
    releaseWarm()
    phase.value = 'arabic'
    // Whatever the phase: a start the OS deferred can land after the phase has moved on
    thaiAudio?.pause()
  }

  /**
   * Visible, the page shows a countdown and navigates to the next surah itself. Hidden (screen
   * locked), its timers are frozen and iOS suspends a page that has gone silent, so the next surah
   * must start here, inside the event that ended this one, while the OS audio session is still
   * open: no idle state in between (it would clear the lock-screen widget) and no awaited fetch.
   */
  function completeChapter() {
    const finished = chapter.value
    if (finished === null) return
    if (finished < LAST_CHAPTER && document.hidden) {
      clearPlayback()
      const next = finished + 1
      const t = resolvedTimings.get(`${reciterId.value}:${next}`)
      // Not prefetched: the start after the fetch may be refused by the OS and is then shown as
      // paused and retried when the page is visible again (see playElement)
      if (t) startFrom(t, 1)
      else playVerse(next, 1)
      return
    }
    stop()
    completedChapter.value = finished
  }

  function finishTranslation() {
    if (phase.value !== 'translation') return
    clearThaiTimer()
    thaiQueue = []
    thaiHeld = null
    phase.value = 'arabic'
    if (verseIdx >= verseStarts.length - 1) {
      completeChapter()
      return
    }
    verseIdx++
    runStart = verseIdx
    repeatsLeft = repeatCount.value - 1
    // Arabic play() before the Thai pause(), for the same reason as in startTranslation
    resumeArabic(verseStarts[verseIdx]!, true)
    thaiAudio?.pause()
  }

  /** Seeks Arabic to `target`, after the pause-between-ayahs gap if one is set. */
  function resumeArabic(target: number, wasPaused: boolean) {
    if (!audio) return
    // Keep the finished ayah highlighted during the gap
    const enterVerse = () => {
      activeVerseKey.value = verseKeys[verseIdx] ?? null
      primeTranslation()
    }

    // Continuing from the stop point needs no seek; iOS seeks in mp3 land tens of ms off
    if (Math.abs(audio.currentTime * 1000 - target) > SEEK_SLACK_MS) audio.currentTime = target / 1000
    if (pauseSeconds.value > 0) {
      gapTimer = setTimeout(() => {
        gapTimer = null
        enterVerse()
        if (audio) playElement(audio)
      }, pauseSeconds.value * 1000)
      if (!wasPaused) audio.pause()
    }
    else {
      enterVerse()
      if (audio.paused) playElement(audio)
      armBoundary()
    }
  }

  function applyTimings(t: RecitationTimings) {
    if (currentTimings === t) return
    currentTimings = t
    segments = t.verses
      .flatMap(v => v.segments.map(([position, start, end]) => ({ verseKey: v.verseKey, position, start, end })))
      .sort((a, b) => a.start - b.start)
    segmentStarts = segments.map(seg => seg.start)
    activeIndex = -1

    verseKeys = [...t.verses].sort((a, b) => a.from - b.from).map(v => v.verseKey)
    computeBoundaries()
    verseIdx = -1
    runStart = -1
  }

  /**
   * Verse stop/start points. Measured pauses (joined runs, stops inside the real pause) are
   * used only while Thai audio is on, so Arabic-only playback behaves exactly as before.
   */
  function computeBoundaries() {
    const t = currentTimings
    if (!t) return
    const verses = [...t.verses].sort((a, b) => a.from - b.from)
    // One window per boundary plus the quiet after the last ayah
    const pauses = translationAudio.value !== 'off' && t.pauses?.length === verses.length ? t.pauses : null
    // Used with Thai on or off: it only moves where ayah 1 starts
    const head = t.head ?? null
    joined = verses.map((_, i) => {
      const p = pauses?.[i]
      return i < verses.length - 1 && !!p && p[1] - p[0] < MIN_PAUSE_MS
    })
    // Word segment ends are not usable as the sound end: they run up to 400 ms early or late
    const lead = verses.some(v => v.segments.length > 0) ? BOUNDARY_LEAD_MS.word : BOUNDARY_LEAD_MS.ayah
    verseEnds = verses.map((v, i) => {
      const next = verses[i + 1]
      const p = pauses?.[i]
      // mp3quran's last `to` can sit seconds before the sound stops; the measured tail is reliable
      // (a tail at the very end of the file leaves the finish to the 'ended' event)
      if (!next) {
        if (!p) return v.to
        const stop = p[1] - p[0] <= LAST_AYAH_SHORT_QUIET_MS ? p[1] - RESUME_GUARD_MS : p[0] + LAST_AYAH_TAIL_MS
        return Math.max(v.from, p[0], stop)
      }
      // A joined boundary is never stopped at; its end is only where the highlight moves on
      const stop = joined[i] ? next.from : p ? Math.min(p[0] + STOP_AFTER_SOUND_MS, p[1] - RESUME_GUARD_MS) : next.from - lead
      return Math.max(v.from, stop)
    })
    // The next ayah continues (and a jump or repeat lands) where the previous one stopped. After a
    // measured real stop it starts a little earlier inside the same silence, so the measured quiet
    // before the voice is at least RESUME_LEAD_MS (never before the previous sound ended)
    verseStarts = verses.map((v, i) => {
      if (i === 0) {
        const from = Math.min(v.from, v.segments[0]?.[1] ?? Infinity)
        // Never before the quiet starts: that would replay the end of a basmala read just before
        return head ? Math.max(head[0], Math.min(from, head[1] - FIRST_AYAH_LEAD_MS)) : Math.max(0, from - FIRST_AYAH_LEAD_MS)
      }
      const end = verseEnds[i - 1]!
      const p = pauses?.[i - 1]
      if (!p || joined[i - 1]) return end
      return Math.max(verses[i - 1]!.from, Math.min(end, Math.max(p[0], p[1] - RESUME_LEAD_MS)))
    })
  }

  /** True when it seeked now; false when already in place or deferred to loadedmetadata. */
  function seekTo(el: HTMLAudioElement, targetMs: number): boolean {
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (Math.abs(el.currentTime * 1000 - targetMs) <= SEEK_SLACK_MS) return false
      el.currentTime = targetMs / 1000
      return true
    }
    // A fresh part file opens at (about) the clip start already: no seek to wait for
    el.addEventListener('loadedmetadata', () => {
      if (Math.abs(el.currentTime * 1000 - targetMs) > SEEK_SLACK_MS) el.currentTime = targetMs / 1000
    }, { once: true })
    return false
  }

  /**
   * Must run inside a user gesture (tap or lock-screen command): iOS only lets such an element play() later.
   * Loads the part of `ayah`, the one about to play, so the later prime finds it in place.
   */
  function unlockThaiAudio(t: ThaiAudio, ayah: number) {
    const el = getThaiAudio()
    const url = partUrl(t, ayah)
    if (url && el.src !== url) el.src = url
    el.play().catch(() => {})
    el.pause()
    if (navigator.userActivation?.isActive !== false) thaiUnlocked = true
  }

  function startFrom(t: RecitationTimings, verseNumber: number) {
    applyTimings(t)
    cancelGap()
    clearThaiTimer()
    thaiQueue = []
    phase.value = 'arabic'
    verseIdx = -1
    runStart = -1
    const el = getAudio()
    if (el.src !== t.audioUrl) el.src = t.audioUrl

    seekTo(el, verseStarts[verseKeys.indexOf(`${t.chapter}:${verseNumber}`)] ?? 0)

    chapter.value = t.chapter
    status.value = 'loading'
    // Autoplay blocked (iOS when timings weren't prefetched) ends up as 'paused': the user can tap resume
    playElement(el)

    // The Thai element only after the Arabic play(): when a surah ends with its Thai clip the clip
    // can still be sounding here, and a background page may start an element only while one plays
    // (see startTranslation). iOS lets an element play() later only if it was started inside a user
    // gesture, so with Thai on the element is primed now, while the click is still on the stack.
    const thai = translationAudio.value === 'mukhtasar' ? resolvedTranslations.get(t.chapter) : null
    if (thai) unlockThaiAudio(thai, verseNumber)
    else thaiAudio?.pause()
    // Starting with metadata older than its max age: the refetch reaches the clips before the first run
    loadTranslation(t.chapter)

    // Cached ahead so the next surah can start synchronously when this one ends on a locked screen
    if (t.chapter < LAST_CHAPTER) {
      loadTimings(t.chapter + 1)
      loadTranslation(t.chapter + 1)
    }
  }

  async function playVerse(chapterId: number, verseNumber: number) {
    if (!import.meta.client) return
    completedChapter.value = null
    cancelTranslation()
    const reciter = reciterId.value
    const cached = resolvedTimings.get(`${reciter}:${chapterId}`)
    if (cached) {
      startFrom(cached, verseNumber)
      return
    }

    status.value = 'loading'
    chapter.value = chapterId
    // Waited for only when there is no metadata yet; a refresh of what is there applies later
    const translation = translationAudio.value === 'mukhtasar' && !resolvedTranslations.has(chapterId) ? loadTranslation(chapterId) : null
    const t = await loadTimings(chapterId, reciter)
    if (translation) await translation
    // Bail if the user stopped or switched surah while the fetch was in flight
    if (!t || chapter.value !== chapterId || status.value !== 'loading') {
      if (!t && chapter.value === chapterId) stop()
      return
    }
    startFrom(t, verseNumber)
  }

  /** The element that is meant to be sounding now. */
  function activeElement() {
    return phase.value === 'translation' ? thaiAudio : audio
  }

  function clearStartTimer() {
    if (startTimer) clearTimeout(startTimer)
    startTimer = null
  }

  /**
   * play() that keeps `status` truthful. A background page may not start an element unless it is
   * still playing another one: newer WebKit then rejects the promise and reverts the element to
   * paused, older WebKit leaves the promise pending and the element paused with no event at all.
   * Either way the element is still paused a moment later, which is what the timer checks.
   */
  function playElement(el: HTMLAudioElement) {
    clearStartTimer()
    el.play().catch(onPlayRejected)
    startTimer = setTimeout(() => {
      startTimer = null
      // 'loading' too: an accepted play() clears `paused` at once, even while the file still loads
      const starting = status.value === 'playing' || status.value === 'loading'
      if (el.paused && el === activeElement() && starting && !gapTimer) markSuspended()
    }, PLAY_START_TIMEOUT_MS)
  }

  function onPlayRejected(e: unknown) {
    // AbortError: our own pause(), src change or stop() cut the start short and already set the state
    if ((e as { name?: string } | null)?.name === 'AbortError' || status.value === 'idle') return
    markSuspended()
  }

  /** The OS refused to play while the intent was to play: shown as paused, resumed on return if the page was hidden. */
  function markSuspended() {
    resumeOnVisible = document.hidden
    status.value = 'paused'
  }

  function pause() {
    if (status.value === 'idle') return
    resumeOnVisible = false
    cancelGap()
    clearStartTimer()
    // Both, not just the active one: iOS can leave the other running after an interruption
    audio?.pause()
    thaiAudio?.pause()
    status.value = 'paused'
  }

  function resume() {
    const el = activeElement()
    if (!el || status.value === 'idle') return
    resumeOnVisible = false
    if (phase.value === 'arabic') {
      // First gesture since a surah started after an awaited fetch: unlock the Thai element now
      const thai = translationAudio.value === 'mukhtasar' && chapter.value !== null ? resolvedTranslations.get(chapter.value) : null
      if (thai && !thaiUnlocked) unlockThaiAudio(thai, Number(verseKeys[verseIdx]?.split(':')[1]))
      if (chapter.value !== null) loadTranslation(chapter.value)
      // Paused inside the gap between ayahs: the next ayah was never entered
      if (verseIdx >= 0) {
        activeVerseKey.value = verseKeys[verseIdx] ?? null
        primeTranslation()
      }
    }
    // A held clip starts through nextThaiClip: the paused element still has the previous position
    else if (thaiHeld) {
      status.value = 'playing'
      nextThaiClip(true)
      return
    }
    if (el.paused) playElement(el)
    else if (status.value !== 'loading') status.value = 'playing'
  }

  function togglePause() {
    if (!audio) return
    if (status.value === 'paused') resume()
    else pause()
  }

  /** Back in view: exactly one element may play, and what the OS stopped behind our back is restarted. */
  function onVisibilityChange() {
    if (document.hidden || status.value === 'idle') return
    const active = activeElement()
    for (const el of [audio, thaiAudio]) {
      if (el && el !== active && !el.paused) el.pause()
    }
    if (!active) return
    if (status.value === 'playing' && !gapTimer && !thaiHeld && active.paused) playElement(active)
    else if (resumeOnVisible && status.value === 'paused') resume()
  }

  /** Drops the position in the current surah; the elements and the status/chapter refs are left to the caller. */
  function clearPlayback() {
    stopTicking()
    cancelGap()
    clearBoundary()
    clearStartTimer()
    resumeOnVisible = false
    reportHint.value = false
    activeVerseKey.value = null
    activeWordKey.value = null
    activeIndex = -1
    verseIdx = -1
    runStart = -1
  }

  function stop() {
    clearPlayback()
    cancelTranslation()
    audio?.pause()
    status.value = 'idle'
    chapter.value = null
  }

  function setReciter(id: number) {
    if (id === reciterId.value) return
    reciterId.value = id
    reciterCookie.value = id
    if (status.value === 'idle' || chapter.value === null) return

    cancelTranslation()
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

  function armBoundary(minWait = 0) {
    clearBoundary()
    if (!audio || audio.paused || verseStarts.length === 0) return
    const ms = audio.currentTime * 1000
    const idx = verseIdx >= 0 ? verseIdx : lastIndexAtOrBefore(verseStarts, ms)
    if (idx < 0) return
    const wait = Math.max(minWait, (verseEnds[idx]! - ms) / audio.playbackRate)
    boundaryTimer = setTimeout(() => {
      boundaryTimer = null
      sync()
      // The audio clock can trail the timer by a few ms; with rAF stopped (locked screen) nothing
      // else retries. Retry soon unless the element is stalled, so the stop stays inside the gap.
      if (!boundaryTimer && audio) armBoundary(audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? 10 : 100)
    }, wait)
  }

  /**
   * Handles repeat / pause-between-ayah when the current ayah has finished.
   * Returns true when it took over playback (caller must not advance).
   */
  function applyVerseEnd(): boolean {
    if (!audio) return false
    const repeating = repeatsLeft > 0
    const isLast = verseIdx >= verseStarts.length - 1
    if (!repeating) {
      const clips = thaiForRun(runStart, verseIdx, true)
      if (clips) {
        startTranslation(clips)
        return true
      }
    }
    if (!repeating && isLast) return false

    // A repeat replays the whole breath group, not just the ayah it ended on
    const target = repeating ? verseStarts[Math.max(0, runStart)]! : verseEnds[verseIdx]!
    if (!repeating && pauseSeconds.value === 0) return false
    if (repeating) {
      repeatsLeft--
      verseIdx = Math.max(0, runStart)
    }
    else {
      verseIdx++
      runStart = verseIdx
      repeatsLeft = repeatCount.value - 1
    }
    resumeArabic(target, false)
    return true
  }

  /** Keeps the active ayah/word in step with the audio and enforces ayah boundaries. */
  function sync() {
    if (!audio || audio.paused || verseStarts.length === 0) return
    const ms = audio.currentTime * 1000

    if (verseIdx >= 0 && ms >= verseEnds[verseIdx]!) {
      if (joined[verseIdx]) {
        // Read in one breath with the next ayah: move the highlight on, keep the run open
        verseIdx++
        activeVerseKey.value = verseKeys[verseIdx] ?? null
        armBoundary()
      }
      else if (applyVerseEnd()) {
        return
      }
    }

    const idx = lastIndexAtOrBefore(verseStarts, ms)
    // The next ayah's start can sit just before this one's stop (it resumes early in the
    // silence), so playing through that overlap is not a jump
    const inCurrent = verseIdx >= 0 && ms >= verseStarts[verseIdx]! && ms < verseEnds[verseIdx]!
    if (idx !== verseIdx && !inCurrent) {
      verseIdx = idx
      runStart = idx
      repeatsLeft = repeatCount.value - 1
      activeVerseKey.value = idx >= 0 ? verseKeys[idx]! : null
      armBoundary()
      primeTranslation()
    }

    if (segments.length === 0) return
    const found = lastIndexAtOrBefore(segmentStarts, ms)
    if (found === activeIndex) return
    const seg = segments[found]
    // QDC first-word segments begin up to ~100 ms before the ayah's `from`, so around a stop
    // point the lookup can land on the next ayah's first word, and resuming early in the silence
    // lands on the previous ayah's last one; the highlight must stay on the ayah being read (and
    // on the one translated while its Thai clip plays)
    if (seg && translationAudio.value !== 'off' && verseIdx >= 0 && verseKeys.indexOf(seg.verseKey) !== verseIdx) return
    activeIndex = found
    activeWordKey.value = seg ? `${seg.verseKey}:${seg.position}` : null
  }

  /** Seeks to the ayah `delta` away from the current one (lock-screen next/previous). */
  function jumpVerse(delta: number) {
    if (!audio || verseStarts.length === 0) return
    cancelTranslation()
    const from = verseIdx >= 0 ? verseIdx : 0
    const target = Math.min(verseStarts.length - 1, Math.max(0, from + delta))
    cancelGap()
    audio.currentTime = verseStarts[target]! / 1000
    verseIdx = -1
    activeVerseKey.value = verseKeys[target] ?? null
    if (audio.paused) playElement(audio)
  }

  function registerMediaSessionActions() {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    // Explicit, not toggles: iOS also fires these itself around interruptions, and the element's
    // own paused flag can disagree with the intent while a start is pending or was refused
    session.setActionHandler('play', () => resume())
    session.setActionHandler('pause', () => pause())
    session.setActionHandler('stop', () => stop())
    session.setActionHandler('previoustrack', () => jumpVerse(-1))
    session.setActionHandler('nexttrack', () => jumpVerse(1))
  }

  /** Feeds the lock-screen / Control Center widget (iOS needs artwork here to show a logo). */
  function updateMediaSession() {
    if (!import.meta.client || !('mediaSession' in navigator)) return
    if (status.value === 'idle' || chapter.value === null) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }
    const surah = useQuranStore().surahs.find(s => s.id === chapter.value)
    const ayah = activeVerseKey.value?.split(':')[1]
    const reciter = reciters.value.find(r => r.id === reciterId.value)
    const origin = window.location.origin
    navigator.mediaSession.metadata = new MediaMetadata({
      title: [`ซูเราะห์ ${surah?.name_thai ?? chapter.value}`, ayah && `อายะห์ ${ayah}`].filter(Boolean).join(' · '),
      artist: phase.value === 'translation' ? TRANSLATION_ARTIST : reciter ? getReciterLabelTh(reciter) : '',
      album: 'อัลกุรอานแปลไทย',
      artwork: [
        { src: `${origin}/icon192_maskable.png`, sizes: '192x192', type: 'image/png' },
        { src: `${origin}/icon512_maskable.png`, sizes: '512x512', type: 'image/png' },
      ],
    })
    navigator.mediaSession.playbackState = status.value === 'playing' ? 'playing' : 'paused'
  }

  watch([status, chapter, activeVerseKey, reciterId, reciters, phase], updateMediaSession)

  function setPlaybackRate(rate: number) {
    if (!(PLAYBACK_SPEEDS as readonly number[]).includes(rate)) return
    playbackRate.value = rate
    speedCookie.value = rate
    if (audio) {
      audio.defaultPlaybackRate = rate
      audio.playbackRate = rate
      armBoundary()
    }
    if (thaiAudio) {
      thaiAudio.defaultPlaybackRate = rate
      thaiAudio.playbackRate = rate
      if (phase.value === 'translation') armThaiEnd()
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

  function setTranslationAudio(value: TranslationAudioSetting) {
    const next = translationAudioEnabled && value === 'mukhtasar' ? 'mukhtasar' : 'off'
    translationAudio.value = next
    translationAudioCookie.value = next
    if (next === 'off') {
      finishTranslation()
      resetTranslationIssue()
    }
    else if (chapter.value !== null) {
      // Turned on mid-playback: unlock the Thai element while this click is still on the stack (iOS)
      const thai = resolvedTranslations.get(chapter.value)
      if (thai && status.value !== 'idle' && phase.value === 'arabic') unlockThaiAudio(thai, Number(activeVerseKey.value?.split(':')[1]))
      loadTranslation(chapter.value)
      if (chapter.value < LAST_CHAPTER) loadTranslation(chapter.value + 1)
    }
    // Boundaries depend on the setting; indices stay valid, only the stop points move
    computeBoundaries()
    if (verseIdx >= 0) {
      runStart = verseIdx
      armBoundary()
    }
  }

  // Learn whether the playing surah has Thai audio even while it's off, so the player can offer it
  watch(chapter, (id) => {
    // Not a notice the new chapter already reported in the same tick
    if (issueChapter !== id) resetTranslationIssue()
    if (id !== null && translationAudio.value === 'off') fetchTranslation(id)
  })

  return {
    translationAudioEnabled,
    translationAudio,
    translationAudioIssue,
    currentChapterHasTranslation,
    reportHint,
    phase,
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
    loadTranslation,
    playVerse,
    togglePause,
    stop,
    setReciter,
    setPlaybackRate,
    setRepeatCount,
    setPauseSeconds,
    setTranslationAudio,
  }
})
