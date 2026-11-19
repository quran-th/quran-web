<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { usePageTranslations } from '~/composables/usePageTranslations'

interface Props {
  open: boolean
  page: number
  verseKey?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const { verses, segments } = usePageTranslations(toRef(props, 'page'), toRef(props, 'open'))

const subtitle = computed(() =>
  segments.value.map(s => `${s.name} · อายะห์ ${s.from}–${s.to}`).join(' / '),
)

const body = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null

function scrollToVerse() {
  const el = body.value
  if (!el) return
  const target = props.verseKey
    ? el.querySelector<HTMLElement>(`[data-verse-key="${props.verseKey}"]`)
    : null
  const top = target ? target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12 : 0
  el.scrollTop = Math.max(0, top)
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
    scrollToVerse()
  }
  else if (opener && opener !== document.body) {
    opener.focus({ preventScroll: true })
    opener = null
  }
})

// Translations may arrive after the sheet opens
watch(verses, async () => {
  if (!props.open) return
  await nextTick()
  scrollToVerse()
})

const dialog = ref<HTMLElement | null>(null)

function trapTab(e: KeyboardEvent) {
  const focusable = dialog.value?.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable || focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement
  if (!dialog.value?.contains(active)) {
    e.preventDefault()
    first.focus()
  }
  else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  }
  else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
  else if (e.key === 'Tab') {
    trapTab(e)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-[rgba(40,32,20,0.28)]" aria-hidden="true" @click="emit('close')" />
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`คำแปลหน้า ${page}`"
        class="absolute inset-x-0 bottom-0 mx-auto flex h-[56vh] max-w-2xl flex-col rounded-t-[20px] bg-paper-pill shadow-[0_-8px_24px_rgba(60,45,25,0.12)]"
      >
        <div class="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-[#cdc6b8]" aria-hidden="true" />
        <div class="flex shrink-0 items-center gap-3 pt-2 pr-2 pl-5">
          <div class="flex min-w-0 flex-1 flex-col">
            <h2 class="text-base font-semibold text-ink">คำแปลหน้า {{ page }}</h2>
            <span class="truncate text-xs text-ink-muted">{{ subtitle }}</span>
          </div>
          <button
            ref="closeButton"
            type="button"
            aria-label="ปิด"
            class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] text-ink-icon hover:bg-paper-tint"
            @click="emit('close')"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <div ref="body" class="scrollbar-dot relative min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-10">
          <MushafPageTranslationVerses :verses="verses" size="sheet" :highlight-key="verseKey" />
        </div>
      </div>
    </div>
  </Transition>
</template>
