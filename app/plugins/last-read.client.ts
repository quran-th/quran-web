// Remembers where the reader is, so the quran.in.th home page can offer "continue reading" or
// "continue listening". Saved in a cookie shared across *.quran.in.th:
// - reading: the reading route as is (its URL already follows the visible ayah or Mushaf page);
// - listening: the ayah the recitation has reached, as /{surah}/{ayah}?play, which resumes playback;
//   when playback pauses or stops, the same ayah without ?play.
import { useRecitationStore } from '~/stores/recitationStore'

const COOKIE = 'last_read'
const READING_ROUTE = /^\/(\d{1,3}(\/\d{1,3})?|page\/\d{1,3})$/

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const recitation = useRecitationStore()
  const shared = location.hostname === 'quran.in.th' || location.hostname.endsWith('.quran.in.th')
  const attributes = `; Path=/; Max-Age=31536000; SameSite=Lax${shared ? '; Domain=.quran.in.th' : ''}${location.protocol === 'https:' ? '; Secure' : ''}`
  const save = (route: string) => {
    document.cookie = `${COOKIE}=${encodeURIComponent(route)}${attributes}`
  }
  const listening = () => recitation.status === 'playing' || recitation.status === 'loading'

  router.afterEach((to) => {
    if (listening() || !READING_ROUTE.test(to.path)) return
    save(to.fullPath)
  })

  // Stopping clears the active ayah, so keep the last one to save it without ?play.
  let lastKey: string | null = null
  watch(
    () => [recitation.activeVerseKey, recitation.status] as const,
    ([key, status]) => {
      if (key) lastKey = key
      const [surah, ayah] = lastKey?.split(':') ?? []
      if (!surah || !ayah || status === 'loading') return
      save(`/${surah}/${ayah}${status === 'playing' ? '?play' : ''}`)
    },
  )
})
