const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Arabic-Indic digits, as printed in the Mushaf. Mapped by hand so SSR and the client agree whatever their ICU data. */
export function toArabicDigits(value: number | string) {
  return String(value).replace(/\d/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]!)
}
