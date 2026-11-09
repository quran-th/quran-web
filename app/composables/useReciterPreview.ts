import { onBeforeUnmount, ref } from 'vue'
import type { RecitationTimings } from '~/types/recitation'

const PREVIEW_CHAPTER = 1
const PREVIEW_LAST_VERSE = 2
// Zero-length WAV: playing it inside the tap unlocks the element on iOS before the timings fetch resolves
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

/** Plays the opening ayahs of Al-Fatihah in a reciter's voice, on its own element so the main player is untouched. */
export function useReciterPreview(loadTimings: (chapterId: number, reciterId: number) => Promise<RecitationTimings | null>) {
  const previewId = ref<number | null>(null)
  const previewLoading = ref(false)
  let el: HTMLAudioElement | null = null
  let endMs = 0
  let token = 0

  function getElement(): HTMLAudioElement {
    if (el) return el
    el = new Audio()
    el.preload = 'auto'
    el.addEventListener('playing', () => { previewLoading.value = false })
    el.addEventListener('timeupdate', () => {
      if (previewId.value !== null && el!.currentTime * 1000 >= endMs) stopPreview()
    })
    el.addEventListener('ended', stopPreview)
    el.addEventListener('error', () => { if (previewId.value !== null && el!.src !== SILENT_WAV) stopPreview() })
    return el
  }

  function stopPreview() {
    token++
    el?.pause()
    previewId.value = null
    previewLoading.value = false
  }

  async function togglePreview(reciterId: number) {
    if (previewId.value === reciterId) return stopPreview()
    stopPreview()
    const mine = token
    const audio = getElement()
    audio.src = SILENT_WAV
    audio.play().catch(() => {})
    previewId.value = reciterId
    previewLoading.value = true

    const timings = await loadTimings(PREVIEW_CHAPTER, reciterId)
    if (mine !== token) return
    const first = timings?.verses[0]
    const last = timings?.verses[PREVIEW_LAST_VERSE - 1] ?? first
    if (!timings || !first || !last) return stopPreview()
    endMs = last.to
    audio.src = `${timings.audioUrl}#t=${first.from / 1000}`
    audio.play().catch(() => { if (mine === token) stopPreview() })
  }

  onBeforeUnmount(stopPreview)

  return { previewId, previewLoading, togglePreview, stopPreview }
}
