import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Reciter, RecitationTimings, TranslationAudio } from '~/types/recitation'
import { getReciterLabelTh } from '~/data/reciter-names-th'
import { useQuranStore } from '~/stores/quranStore'

export const DEFAULT_RECITER_ID = 7
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const MAX_REPEAT = 3
export const MAX_PAUSE_SECONDS = 5
export const TRANSLATION_ARTIST = 'คำแปลอัล-มุคตะศ็อร (เสียง AI)'
// Slack on top of the clip length before a stalled Thai element is abandoned
const TRANSLATION_STALL_MS = 5000
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

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused'

interface FlatSegment {
  verseKey: string
  position: number
  start: number
  end: number
}

interface ThaiClip {
  verseKey: string
  startMs: number
  endMs: number
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
  let thaiUnlocked = false
  let thaiEndMs = 0
  let thaiTimer: ReturnType<typeof setTimeout> | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  // Playback the OS stopped while the user meant to keep listening; picked up when the page is visible again
  let resumeOnVisible = false
  // Clips still to play after the current one (one per ayah of the run, contiguous in the file)
  let thaiQueue: ThaiClip[] = []
  const translationCache = new Map<number, Promise<TranslationAudio | null>>()
  // null = chapter has no Thai audio
  const resolvedTranslations = new Map<number, TranslationAudio | null>()
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
  function loadTranslation(chapterId: number): Promise<TranslationAudio | null> {
    if (translationAudio.value === 'off') return Promise.resolve(null)
    return fetchTranslation(chapterId)
  }

  function fetchTranslation(chapterId: number): Promise<TranslationAudio | null> {
    if (!translationAudioEnabled) return Promise.resolve(null)
    let pending = translationCache.get(chapterId)
    if (!pending) {
      pending = $fetch<{ success: boolean; data: TranslationAudio }>(`/api/translation-audio/${chapterId}`)
        .then((r) => {
          const data = r.success ? r.data : null
          resolvedTranslations.set(chapterId, data)
          translationAvailability.value = { ...translationAvailability.value, [chapterId]: !!data }
          return data
        })
        .catch((e) => {
          if (e?.statusCode === 404) {
            resolvedTranslations.set(chapterId, null)
            translationAvailability.value = { ...translationAvailability.value, [chapterId]: false }
            return null
          }
          console.error('Failed to fetch translation audio:', e)
          translationCache.delete(chapterId)
          return null
        })
      translationCache.set(chapterId, pending)
    }
    return pending
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
      if (verseIdx >= 0 && (repeatsLeft > 0 || thaiForRun(runStart, verseIdx)) && applyVerseEnd()) return
      const finished = chapter.value
      stop()
      completedChapter.value = finished
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
      if (phase.value !== 'translation') {
        el.pause()
        return
      }
      status.value = 'playing'
      armThaiEnd()
    })
    el.addEventListener('pause', () => {
      if (phase.value !== 'translation') return
      if (status.value === 'playing') status.value = 'paused'
      clearThaiTimer()
    })
    el.addEventListener('timeupdate', () => {
      if (phase.value === 'translation' && !el.seeking && el.currentTime * 1000 >= thaiEndMs) nextThaiClip()
    })
    el.addEventListener('ended', nextThaiClip)
    el.addEventListener('error', () => {
      if (phase.value !== 'translation') return
      console.error('Translation audio failed to play')
      finishTranslation()
    })
    return el
  }

  function clearThaiTimer() {
    if (thaiTimer) clearTimeout(thaiTimer)
    thaiTimer = null
  }

  // Timer-driven like armBoundary: timeupdate and rAF are throttled on a locked screen
  function armThaiEnd() {
    clearThaiTimer()
    if (!thaiAudio || thaiAudio.paused) return
    const remaining = thaiEndMs - thaiAudio.currentTime * 1000
    // The audio clock trails the timer by tens of ms: re-check until the clip end is really reached
    const wait = remaining / thaiAudio.playbackRate
    thaiTimer = remaining > SEEK_SLACK_MS ? setTimeout(armThaiEnd, Math.max(50, wait)) : setTimeout(nextThaiClip, Math.max(0, wait))
  }

  /** Thai clips for verses start..end (ayahs without a clip are skipped), or null if none. */
  function thaiForRun(start: number, end: number) {
    if (translationAudio.value === 'off' || chapter.value === null) return null
    const t = resolvedTranslations.get(chapter.value)
    if (!t) return null
    const clips: ThaiClip[] = []
    for (let i = Math.max(0, start); i <= end; i++) {
      const verseKey = verseKeys[i]
      const entry = t.ayahs.find(a => a.ayah === Number(verseKey?.split(':')[1]))
      if (verseKey && entry) clips.push({ verseKey, startMs: entry.startMs, endMs: entry.endMs })
    }
    return clips.length > 0 ? { t, clips } : null
  }

  /**
   * Seeks the idle Thai element to the clip that will play first after the current run,
   * while the Arabic still plays, so play() at the boundary starts at once instead of
   * seeking first (which eats the first tens of ms on iOS).
   */
  function primeTranslation() {
    if (phase.value !== 'arabic') return
    const thai = thaiForRun(runStart, runStart)
    if (!thai) return
    const el = getThaiAudio()
    if (el.src !== thai.t.audioUrl) el.src = thai.t.audioUrl
    seekTo(el, thai.clips[0]!.startMs)
  }

  function startTranslation(t: TranslationAudio, clips: ThaiClip[]) {
    if (!audio) return
    phase.value = 'translation'
    // 'ended' pauses the element before this runs; playing stays the intent
    status.value = 'playing'
    const el = getThaiAudio()
    if (el.src !== t.audioUrl) el.src = t.audioUrl
    thaiQueue = [...clips]
    // Thai play() before the Arabic pause(): a background page is only allowed to start an element
    // while it is still playing one (the OS audio session stays active, see playElement); the Arabic
    // is inside the silence between ayahs here, so the few ms of overlap are inaudible
    nextThaiClip()
    audio.pause()
  }

  /** Plays the next queued clip (highlight follows it); resumes the Arabic when the queue is empty. */
  function nextThaiClip() {
    if (phase.value !== 'translation') return
    const clip = thaiQueue.shift()
    if (!clip) {
      finishTranslation()
      return
    }
    const el = getThaiAudio()
    // Whole-ayah highlight while its Thai plays: no single word is being read
    activeVerseKey.value = clip.verseKey
    activeWordKey.value = null
    activeIndex = -1
    thaiEndMs = clip.endMs
    clearThaiTimer()
    if (el.paused) {
      seekTo(el, clip.startMs)
      // A clip that started but never reaches its end must not stall the reading. A clip that never
      // started was refused by the OS and is left to playElement, which shows it as paused.
      thaiTimer = setTimeout(() => {
        if (!el.paused) nextThaiClip()
      }, (clip.endMs - clip.startMs) / el.playbackRate + TRANSLATION_STALL_MS)
      playElement(el)
    }
    else {
      // Still playing from the previous clip, which this one follows in the file: no seek, and
      // no 'playing' event will arm the end
      armThaiEnd()
    }
  }

  /** Stops the Thai clips without resuming Arabic. */
  function cancelTranslation() {
    clearThaiTimer()
    thaiQueue = []
    phase.value = 'arabic'
    // Whatever the phase: a start the OS deferred can land after the phase has moved on
    thaiAudio?.pause()
  }

  function finishTranslation() {
    if (phase.value !== 'translation') return
    clearThaiTimer()
    thaiQueue = []
    phase.value = 'arabic'
    if (verseIdx >= verseStarts.length - 1) {
      const finished = chapter.value
      stop()
      completedChapter.value = finished
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

  function seekTo(el: HTMLAudioElement, targetMs: number) {
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (Math.abs(el.currentTime * 1000 - targetMs) > SEEK_SLACK_MS) el.currentTime = targetMs / 1000
    }
    else {
      el.addEventListener('loadedmetadata', () => { el.currentTime = targetMs / 1000 }, { once: true })
    }
  }

  /** Must run inside a user gesture (tap or lock-screen command): iOS only lets such an element play() later. */
  function unlockThaiAudio(t: TranslationAudio) {
    const el = getThaiAudio()
    if (el.src !== t.audioUrl) el.src = t.audioUrl
    el.play().catch(() => {})
    el.pause()
    if (navigator.userActivation?.isActive !== false) thaiUnlocked = true
  }

  function startFrom(t: RecitationTimings, verseNumber: number) {
    applyTimings(t)
    cancelGap()
    cancelTranslation()
    verseIdx = -1
    runStart = -1
    const el = getAudio()
    if (el.src !== t.audioUrl) el.src = t.audioUrl

    seekTo(el, verseStarts[verseKeys.indexOf(`${t.chapter}:${verseNumber}`)] ?? 0)

    // iOS only lets an element play() later if it was started inside a user gesture,
    // so the Thai element is primed here, while the click is still on the stack
    const thai = translationAudio.value === 'mukhtasar' ? resolvedTranslations.get(t.chapter) : null
    if (thai) unlockThaiAudio(thai)

    chapter.value = t.chapter
    status.value = 'loading'
    // Autoplay blocked (iOS when timings weren't prefetched) ends up as 'paused': the user can tap resume
    playElement(el)
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
    const translation = translationAudio.value === 'mukhtasar' ? loadTranslation(chapterId) : null
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
      if (el.paused && el === activeElement() && status.value === 'playing' && !gapTimer) markSuspended()
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
      if (thai && !thaiUnlocked) unlockThaiAudio(thai)
      // Paused inside the gap between ayahs: the next ayah was never entered
      if (verseIdx >= 0) {
        activeVerseKey.value = verseKeys[verseIdx] ?? null
        primeTranslation()
      }
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
    if (status.value === 'playing' && !gapTimer && active.paused) playElement(active)
    else if (resumeOnVisible && status.value === 'paused') resume()
  }

  function stop() {
    stopTicking()
    cancelGap()
    clearBoundary()
    clearStartTimer()
    cancelTranslation()
    audio?.pause()
    resumeOnVisible = false
    status.value = 'idle'
    chapter.value = null
    reportHint.value = false
    activeVerseKey.value = null
    activeWordKey.value = null
    activeIndex = -1
    verseIdx = -1
    runStart = -1
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
      const thai = thaiForRun(runStart, verseIdx)
      if (thai) {
        startTranslation(thai.t, thai.clips)
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
    if (next === 'off') finishTranslation()
    else if (chapter.value !== null) {
      // Turned on mid-playback: unlock the Thai element while this click is still on the stack (iOS)
      const thai = resolvedTranslations.get(chapter.value)
      if (thai && status.value !== 'idle' && phase.value === 'arabic') unlockThaiAudio(thai)
      else loadTranslation(chapter.value)
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
    if (id !== null && translationAudio.value === 'off') fetchTranslation(id)
  })

  return {
    translationAudioEnabled,
    translationAudio,
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
