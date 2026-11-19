import { computed, ref } from 'vue'

const activeId = ref<string | null>(null)

/** One footnote popover at a time; the page reads `footnotePopoverOpen` to lock page turns while it is open. */
export function useFootnotePopover() {
  return {
    activeId,
    footnotePopoverOpen: computed(() => activeId.value !== null),
  }
}
