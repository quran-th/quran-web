export type ReaderLayout = 'spread' | 'pane' | 'phone'

export interface TourStep {
  /** `data-tour` value of the element to spotlight */
  target: string
  title: string
  body: string
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
const seenThisVisit = new Set<ReaderLayout>()

export function hasSeenReaderTour(layout: ReaderLayout) {
  if (seenThisVisit.has(layout)) return true
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + layout) === '1'
  }
  catch {
    return false
  }
}

export function markReaderTourSeen(layout: ReaderLayout) {
  seenThisVisit.add(layout)
  try {
    window.localStorage.setItem(STORAGE_PREFIX + layout, '1')
  }
  catch {
    // in-memory flag above is enough
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
      { target: 'page', title: 'แตะอายะห์เพื่ออ่านคำแปล', body: 'แตะคำใดก็ได้บนหน้ามุศฮัฟ คำแปลของอายะห์นั้นจะเปิดขึ้นจากด้านล่าง' },
      mouse
        ? { target: 'range', title: 'พลิกหน้า', body: 'คลิกขอบซ้ายของหน้าหรือกดปุ่ม ← เพื่อไปหน้าถัดไป และคลิกขอบขวาหรือกดปุ่ม → เพื่อย้อนกลับ ตามทิศการอ่านของมุศฮัฟ' }
        : { target: 'range', title: 'ปัดเพื่อพลิกหน้า', body: 'ปัดไปทางขวาเพื่อไปหน้าถัดไป และปัดไปทางซ้ายเพื่อย้อนกลับ ตามทิศการอ่านของมุศฮัฟ' },
      { target: 'translation', title: 'คำแปลทั้งหน้า', body: 'เปิดคำแปลของทุกอายะห์ในหน้านี้ได้ในครั้งเดียว' },
      { target: 'menu', title: 'เมนูเพิ่มเติม', body: 'ฟังเสียงอ่าน แจ้งคำแปลที่ผิดพลาด และตั้งค่าฉบับแปลกับขนาดตัวอักษร' },
    ]
  }

  const verseTap: TourStep = {
    target: 'page',
    title: 'แตะอายะห์เพื่อหาคำแปล',
    body: 'แตะคำใดก็ได้บนหน้ามุศฮัฟ คำแปลของอายะห์นั้นจะถูกเน้นในคอลัมน์ข้าง ๆ',
  }
  const common: TourStep[] = [
    {
      target: 'nav',
      title: 'พลิกหน้า',
      body: mouse
        ? 'กดลูกศร คลิกที่ขอบหน้ากระดาษ หรือใช้ปุ่ม ← → บนแป้นพิมพ์ หน้าถัดไปอยู่ทางซ้ายตามแบบมุศฮัฟ'
        : 'กดลูกศรหรือปัดหน้าจอ หน้าถัดไปอยู่ทางซ้ายตามแบบมุศฮัฟ',
    },
    { target: 'report', title: 'แจ้งข้อผิดพลาด', body: 'พบคำแปลที่ผิดหรือพิมพ์ผิด แจ้งเราได้ที่นี่ เพื่อช่วยกันปรับปรุงคำแปล' },
    { target: 'listen', title: 'ฟังเสียงอ่าน', body: 'ฟังการอ่านอัลกุรอาน เริ่มจากอายะห์แรกของหน้านี้ เปิดเสียงคำแปลภาษาไทยเพิ่มได้ที่แถบเครื่องเล่น' },
    { target: 'settings', title: 'ตั้งค่าการอ่าน', body: 'เลือกฉบับแปลและปรับขนาดตัวอักษร' },
  ]

  if (layout === 'pane') {
    return [
      { target: 'translation', title: 'เปิด–ปิดคำแปล', body: 'ซ่อนคอลัมน์คำแปลเมื่ออยากอ่านหน้ามุศฮัฟเต็มจอ แล้วเปิดกลับได้ทุกเมื่อ' },
      ...(verseTapWorks ? [verseTap] : []),
      ...common,
    ]
  }

  return [
    {
      target: 'mode',
      title: 'สองแบบการอ่าน',
      body: `${LAYOUT_INFO.mushaf.title}: ${LAYOUT_INFO.mushaf.body}\n${LAYOUT_INFO.book.title}: ${LAYOUT_INFO.book.body}`
        + (mouse ? '\nชี้ที่ปุ่มเพื่อดูคำอธิบายนี้อีกครั้ง' : ''),
    },
    ...(verseTapWorks ? [verseTap] : []),
    ...common,
    { target: 'index', title: 'สารบัญ', body: 'ข้ามไปยังซูเราะห์ใดก็ได้จากรายชื่อทั้ง 114 ซูเราะห์' },
  ]
}
