import type { Reciter } from '~/types/recitation'

/**
 * Thai display names keyed by quran.com reciter ID (see quran-api
 * src/data/reciters.ts). Unknown IDs fall back to the English name from the API.
 */
const RECITER_NAMES_TH: Record<number, string> = {
  7: 'มิชารี รอชิด อัล-อะฟาซีย์',
  2: 'อับดุลบาสิฏ อับดุศเศาะมัด',
  1: 'อับดุลบาสิฏ อับดุศเศาะมัด',
  3: 'อับดุรเราะห์มาน อัส-ซุดัยส์',
  4: 'อบูบักร์ อัช-ชาฏิรีย์',
  5: 'ฮานี อัร-ริฟาอีย์',
  6: 'มะห์มูด เคาะลีล อัล-หุศ็อรีย์',
  12: 'มะห์มูด เคาะลีล อัล-หุศ็อรีย์',
  9: 'มุฮัมมัด ศิดดีก อัล-มินชาวีย์',
  10: 'สะอูด อัช-ชุร็อยม์',
  97: 'ยาซิร อัด-ดูสะรีย์',
  161: 'เคาะลีฟะฮ์ อัฏ-ฏุนัยญีย์',
}

// Plain Thai meanings rather than transliterations (มุรัตตัล/มุญัววัด/มุอัลลิม),
// which most readers don't recognise
const RECITATION_STYLES_TH: Record<string, string> = {
  Murattal: 'ทำนองปกติ',
  // Not "ไพเราะ" — that implies other styles aren't
  Mujawwad: 'การอ่านทำนอง',
  Muallim: 'ช้า สำหรับฝึกอ่าน',
}

/** Validates ?reciter= from shared links against reciters with word timings */
export function isKnownReciter(id: number): boolean {
  return Number.isInteger(id) && id in RECITER_NAMES_TH
}

export function getReciterLabelTh(reciter: Reciter): string {
  const name = RECITER_NAMES_TH[reciter.id] ?? reciter.name
  const style = RECITATION_STYLES_TH[reciter.style] ?? reciter.style
  return `${name} (${style})`
}
