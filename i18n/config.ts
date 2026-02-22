export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'th',
  fallbackLocale: 'th',
  numberFormats: {
    th: {
      decimal: {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      },
    },
  },
}))
