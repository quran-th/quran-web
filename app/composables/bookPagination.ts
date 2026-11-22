export interface BookItem {
  key: string
  kind: 'verse' | 'header'
  rowHeight: number
  footnoteHeights: number[]
}

export interface BookPage {
  items: string[]
  footnoteStart: number[]
  overflow: boolean
}

export interface BookPaginationOptions {
  pageHeight: number
  footnoteAreaGap: number
  footnoteGap: number
}

export function paginateBook(items: BookItem[], opts: BookPaginationOptions): BookPage[] {
  const { pageHeight, footnoteAreaGap, footnoteGap } = opts
  const pages: BookPage[] = []

  let current: BookPage = { items: [], footnoteStart: [], overflow: false }
  let rowsHeight = 0
  let footnoteCount = 0
  let footnotesHeight = 0
  let lastItem: BookItem | undefined

  const footnoteBlock = (count: number, height: number) =>
    count === 0 ? 0 : footnoteAreaGap + height + footnoteGap * (count - 1)

  const place = (item: BookItem) => {
    current.items.push(item.key)
    lastItem = item
    current.footnoteStart.push(footnoteCount + 1)
    rowsHeight += item.rowHeight
    footnoteCount += item.footnoteHeights.length
    footnotesHeight += item.footnoteHeights.reduce((sum, h) => sum + h, 0)
  }

  const startNewPage = () => {
    pages.push(current)
    current = { items: [], footnoteStart: [], overflow: false }
    rowsHeight = 0
    footnoteCount = 0
    footnotesHeight = 0
    lastItem = undefined
  }

  // current page is empty after startNewPage, so footnoteStart restarts at 1
  const fitsOnCurrent = (item: BookItem) =>
    rowsHeight + item.rowHeight
      + footnoteBlock(
        footnoteCount + item.footnoteHeights.length,
        footnotesHeight + item.footnoteHeights.reduce((sum, h) => sum + h, 0),
      ) <= pageHeight

  for (const item of items) {
    if (current.items.length > 0 && !fitsOnCurrent(item)) {
      const orphanHeader = item.kind === 'verse' && lastItem?.kind === 'header' && current.items.length > 1 ? lastItem : null
      if (orphanHeader) {
        current.items.pop()
        current.footnoteStart.pop()
        rowsHeight -= orphanHeader.rowHeight
      }
      startNewPage()
      if (orphanHeader) place(orphanHeader)
    }

    if (current.items.length > 0 && !fitsOnCurrent(item)) {
      // header carried over plus this verse still overflows: header keeps its page alone
      startNewPage()
    }

    const fitsEmpty = fitsOnCurrent(item)
    place(item)
    if (!fitsEmpty) {
      current.overflow = true
      startNewPage()
    }
  }

  if (current.items.length > 0) pages.push(current)
  return pages
}

export interface BookLayoutOptions extends BookPaginationOptions {
  /** A spread starts at this item, as the Mushaf page the reader came from does */
  breakKey?: string
  /** Pages already shown on the previous surah's last spread; spreads start after them */
  lead: number
}

const itemHeight = (item: BookItem) => item.rowHeight + item.footnoteHeights.reduce((sum, h) => sum + h, 0)

function splitPage(page: BookPage, byKey: Map<string, BookItem>, opts: BookPaginationOptions): BookPage[] | null {
  if (page.overflow) return null
  const items = page.items.map(key => byKey.get(key)!)
  // A surah header never ends up alone on a page
  const minCut = items[0]?.kind === 'header' ? 2 : 1
  if (items.length <= minCut) return null

  const total = items.reduce((sum, item) => sum + itemHeight(item), 0)
  let best = minCut
  let bestGap = Infinity
  let above = items.slice(0, minCut).reduce((sum, item) => sum + itemHeight(item), 0)
  for (let cut = minCut; cut < items.length; cut++) {
    const gap = Math.abs(total - 2 * above)
    if (gap < bestGap) {
      best = cut
      bestGap = gap
    }
    above += itemHeight(items[cut]!)
  }
  const halves = [items.slice(0, best), items.slice(best)].map(group => paginateBook(group, opts))
  return halves.every(half => half.length === 1) ? halves.map(half => half[0]!) : null
}

/**
 * Paginates a surah so that `breakKey` opens a spread (the right page). Pages
 * before it keep their natural flow; when they come out odd, the nearest page
 * that can be is split in two, or else a blank left page fills the gap.
 */
export function layoutBook(items: BookItem[], opts: BookLayoutOptions): BookPage[] {
  const { breakKey, lead, ...pageOpts } = opts
  const natural = paginateBook(items, pageOpts)
  const breakIndex = breakKey ? items.findIndex(item => item.key === breakKey) : -1
  if (breakIndex <= 1) return natural

  const naturalStart = natural.findIndex(page => page.items[0] === breakKey)
  if (naturalStart !== -1 && (naturalStart - lead) % 2 === 0) return natural
  // The lead page was already read beside the previous surah, so it can't change
  if (natural.slice(0, lead).some(page => page.items.includes(breakKey!))) return natural

  const before = paginateBook(items.slice(0, breakIndex), pageOpts)
  const after = paginateBook(items.slice(breakIndex), pageOpts)
  if ((before.length - lead) % 2 === 1) {
    const byKey = new Map(items.map(item => [item.key, item]))
    let split = false
    // Nearest the break first, so the thinned-out pages sit where the reader joined
    for (let i = before.length - 1; i >= lead && !split; i--) {
      const halves = splitPage(before[i]!, byKey, pageOpts)
      if (halves) {
        before.splice(i, 1, ...halves)
        split = true
      }
    }
    if (!split) before.push({ items: [], footnoteStart: [], overflow: false })
  }
  return [...before, ...after]
}
