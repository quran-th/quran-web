import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{vue,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["'UthmanicHafs'", "'Amiri'", 'serif'],
      },
    },
  },
} satisfies Config
