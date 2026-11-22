export type ReaderLayout = 'spread' | 'pane' | 'phone'

export interface TourStep {
  /**
   * The release that brought this step in. A reader who saw an earlier tour is
   * shown only the steps released since, so tag a new step with the version it ships in.
   */
  since: string
  /** `data-tour` value of the element to spotlight */
  target: string
  title: string
  body: string
  /** A looping gesture played over the spotlit area, for touch-only actions */
  gesture?: 'swipe'
  /** Listed under the body: a bold topic, then a short line on it */
  points?: { title: string, body: string }[]
  /** A fixed snapshot shown in the card, so a step can show a layout without moving the reader */
  image?: { src: string, alt: string }
}

/** What each reading layout is for, shown on the layout switch and in the tour */
export const LAYOUT_INFO = {
  mushaf: {
    title: 'มุศฮัฟ',
    body: 'อ่านหน้าอัลกุรอานแบบมุศฮัฟ โดยมีคำแปลอยู่ข้าง ๆ ให้ดูเมื่อต้องการ',
  },
  book: {
    title: 'สองภาษา',
    body: 'อ่านอายะห์กับความหมายเคียงกันทีละอายะห์ เหมาะกับฉบับแปลที่มีเชิงอรรถ ซึ่งจะแสดงอยู่ท้ายหน้า',
  },
} as const

const STORAGE_PREFIX = 'reader-tour-seen:'
// Private-mode browsers can refuse localStorage; then the tour only stays dismissed for this visit
const seenThisVisit = new Map<ReaderLayout, string>()

function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const isVersion = (value: string | null): value is string => !!value && /^\d+\.\d+\.\d+$/.test(value)

/** The newest tour version this reader has seen on a layout, or null if none */
function seenTourVersion(layout: ReaderLayout): string | null {
  const inMemory = seenThisVisit.get(layout) ?? null
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(STORAGE_PREFIX + layout)
  }
  catch {
    // in-memory value only
  }
  const versions = [inMemory, stored].filter(isVersion)
  return versions.sort(compareVersions).at(-1) ?? null
}

/** The steps a reader hasn't seen yet: all of them on a first visit, then only newer releases' */
export function unseenTourSteps(layout: ReaderLayout, steps: TourStep[]): TourStep[] {
  const seen = seenTourVersion(layout)
  return seen ? steps.filter(step => compareVersions(step.since, seen) > 0) : steps
}

/** True once the reader has seen some version of this layout's tour */
export function hasSeenAnyReaderTour(layout: ReaderLayout) {
  return seenTourVersion(layout) !== null
}

/** Records the newest version among the layout's steps, so the next release's steps show on their own */
export function markReaderTourSeen(layout: ReaderLayout, steps: TourStep[]) {
  const newest = steps.map(step => step.since).sort(compareVersions).at(-1)
  if (!newest) return
  const seen = seenTourVersion(layout)
  if (seen && compareVersions(seen, newest) >= 0) return
  seenThisVisit.set(layout, newest)
  try {
    window.localStorage.setItem(STORAGE_PREFIX + layout, newest)
  }
  catch {
    // in-memory value above is enough
  }
}

/**
 * Each layout shows different controls, so each gets its own tour, seen once.
 * `verseTapWorks` is false when no translation column is on screen to highlight.
 * `mouse` swaps swiping for clicking the page edge, which only exists for a mouse or trackpad.
 */
export function readerTourSteps(layout: ReaderLayout, verseTapWorks: boolean, mouse: boolean): TourStep[] {
  if (layout === 'phone') {
    return [
      { since: '1.32.0', target: 'page', title: 'แตะอายะห์เพื่ออ่านคำแปล', body: 'แตะคำใดก็ได้บนหน้ามุศฮัฟ คำแปลของอายะห์นั้นจะเปิดขึ้นจากด้านล่าง' },
      mouse
        ? { since: '1.32.0', target: 'edge', title: 'พลิกหน้า', body: 'คลิกขอบซ้ายของหน้าหรือกดปุ่ม ← เพื่อไปหน้าถัดไป และคลิกขอบขวาหรือกดปุ่ม → เพื่อย้อนกลับ ตามทิศการอ่านของมุศฮัฟ' }
        : { since: '1.32.0', target: 'page', gesture: 'swipe', title: 'ปัดเพื่อพลิกหน้า', body: 'ปัดไปทางขวาเพื่อไปหน้าถัดไป และปัดไปทางซ้ายเพื่อย้อนกลับ ตามทิศการอ่านของมุศฮัฟ' },
      { since: '1.32.0', target: 'translation', title: 'คำแปลทั้งหน้า', body: 'เปิดคำแปลของทุกอายะห์ในหน้านี้ได้ในครั้งเดียว' },
      { since: '1.32.0', target: 'menu', title: 'เมนูเพิ่มเติม', body: 'ฟังเสียงอ่าน แจ้งคำแปลที่ผิดพลาด และตั้งค่าฉบับแปลกับขนาดตัวอักษร' },
    ]
  }

  const verseTap: TourStep = {
    since: '1.32.0',
    target: 'page',
    title: 'แตะอายะห์เพื่อหาคำแปล',
    body: 'แตะคำใดก็ได้บนหน้ามุศฮัฟ คำแปลของอายะห์นั้นจะถูกเน้นในคอลัมน์ข้าง ๆ',
  }
  const common: TourStep[] = [
    // Page edges are click zones for a mouse only; touch screens turn by swiping
    mouse
      ? {
          since: '1.32.0',
          target: 'edge',
          title: 'พลิกหน้า',
          body: 'คลิกขอบซ้ายของหน้าเพื่อไปหน้าถัดไป และขอบขวาเพื่อย้อนกลับ ตามแบบมุศฮัฟ หรือใช้ปุ่ม ← → บนแป้นพิมพ์',
        }
      : {
          since: '1.32.0',
          target: 'page',
          gesture: 'swipe',
          title: 'ปัดเพื่อพลิกหน้า',
          body: 'ปัดไปทางขวาเพื่อไปหน้าถัดไป และปัดไปทางซ้ายเพื่อย้อนกลับ ตามทิศการอ่านของมุศฮัฟ หรือกดลูกศรด้านบน',
        },
    { since: '1.32.0', target: 'report', title: 'แจ้งข้อผิดพลาด', body: 'พบคำแปลที่ผิดหรือพิมพ์ผิด แจ้งเราได้ที่นี่ เพื่อช่วยกันปรับปรุงคำแปล' },
    { since: '1.32.0', target: 'listen', title: 'ฟังเสียงอ่าน', body: 'ฟังการอ่านอัลกุรอาน เริ่มจากอายะห์แรกของหน้านี้ เปิดเสียงคำแปลภาษาไทยเพิ่มได้ที่แถบเครื่องเล่น' },
    {
      since: '1.32.0',
      target: 'settings',
      title: 'ตั้งค่าการอ่าน',
      body: 'ปรับการอ่านให้เหมาะกับคุณได้ที่นี่',
      points: [
        { title: 'คำแปล', body: 'เลือกฉบับแปลภาษาไทยที่ต้องการอ่าน' },
        { title: 'รูปแบบตัวอักษร', body: 'เลือกอักษรอาหรับแบบอุษมานีย์ มะญีด หรือตัจวีด' },
        { title: 'ขนาดอักษร', body: 'ปรับขนาดตัวอักษรให้อ่านสบายตา' },
        { title: 'ดูวิธีใช้งานอีกครั้ง', body: 'เปิดคำแนะนำชุดนี้ได้ทุกเมื่อ' },
      ],
    },
  ]

  if (layout === 'pane') {
    return [
      { since: '1.32.0', target: 'translation', title: 'เปิด–ปิดคำแปล', body: 'ซ่อนคอลัมน์คำแปลเมื่ออยากอ่านหน้ามุศฮัฟเต็มจอ แล้วเปิดกลับได้ทุกเมื่อ' },
      ...(verseTapWorks ? [verseTap] : []),
      ...common,
    ]
  }

  return [
    {
      since: '1.32.0',
      target: 'mode',
      title: 'สองแบบการอ่าน',
      body: `สลับระหว่าง${LAYOUT_INFO.mushaf.title}และ${LAYOUT_INFO.book.title}ได้ที่ปุ่มนี้ มาดูตัวอย่างแต่ละแบบกัน`
        + (mouse ? ' ภายหลังชี้ที่ปุ่มเพื่อดูคำอธิบายได้อีกครั้ง' : ''),
    },
    // Snapshots of Mushaf pages 591–592 (juz 30), from the opening of Al-Aʿlā: short ayahs fill
    // both pages. The bilingual one uses King Fahd (source 3), whose footnotes are what it is suited to
    {
      since: '1.32.0',
      target: 'mode',
      title: LAYOUT_INFO.mushaf.title,
      body: LAYOUT_INFO.mushaf.body,
      image: { src: '/tour/layout-mushaf.webp', alt: 'ตัวอย่างหน้ามุศฮัฟ 591–592 พร้อมคำแปลข้างหน้า' },
    },
    {
      since: '1.32.0',
      target: 'mode',
      title: LAYOUT_INFO.book.title,
      body: LAYOUT_INFO.book.body,
      image: { src: '/tour/layout-book.webp', alt: 'ตัวอย่างแบบสองภาษา อายะห์กับคำแปลเคียงกัน พร้อมเชิงอรรถท้ายหน้า' },
    },
    ...(verseTapWorks ? [verseTap] : []),
    ...common,
    { since: '1.32.0', target: 'index', title: 'สารบัญ', body: 'ข้ามไปยังซูเราะห์ใดก็ได้จากรายชื่อทั้ง 114 ซูเราะห์' },
  ]
}
