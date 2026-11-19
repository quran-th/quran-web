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
