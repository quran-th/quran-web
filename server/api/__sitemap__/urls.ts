import { defineSitemapEventHandler } from '#imports'

export default defineSitemapEventHandler(() => {
  const surahs = Array.from({ length: 114 }, (_, i) => ({
    loc: `/surah/${i + 1}`,
    priority: 0.8,
    changefreq: 'weekly' as const,
  }))

  return surahs
})
