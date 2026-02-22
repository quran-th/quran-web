<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QuranWord } from '~/types/quran'

interface Footnote {
  number: number
  text: string
}

interface Verse {
  verseNumber: number
  content: string
  translation: string
  footnotes?: Footnote[]
  isVerified?: boolean
}

interface Props {
  verse: Verse
  surahNumber: number
  surahName?: string
  words?: QuranWord[]
  isFontLoaded?: (pageNumber: number) => boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  play: [verse: Verse]
  bookmark: [verse: Verse]
  copy: [verse: Verse]
  share: [verse: Verse]
  report: [verse: Verse]
}>()

const isCopied = ref(false)
const isBookmarked = ref(false)
const showMenu = ref(false)

/** Strip (*N*) footnote markers from translation text for clean display */
const cleanTranslation = computed(() => props.verse.translation.replace(/\(\*\d+\*\)/g, ''))

async function handleCopy() {
  try {
    const textToCopy = `${props.surahName || ''} (${props.surahNumber}:${props.verse.verseNumber})\n\n${props.verse.content}\n\n${props.verse.translation}`
    await navigator.clipboard.writeText(textToCopy)
    isCopied.value = true
    emit('copy', props.verse)
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  }
  catch (err) {
    console.error('Failed to copy:', err)
  }
}

function toggleBookmark() {
  isBookmarked.value = !isBookmarked.value
  emit('bookmark', props.verse)
}

function handlePlay() {
  emit('play', props.verse)
}

function handleShare() {
  emit('share', props.verse)
}

function handleReport() {
  emit('report', props.verse)
  showMenu.value = false
}

function toggleMenu(event: Event) {
  event.stopPropagation()
  showMenu.value = !showMenu.value
}

function handleClickOutside() {
  showMenu.value = false
}
</script>

<template>
  <div class="relative" @click="handleClickOutside">
    <!-- Actions row: action icons on left, share and report on right -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <!-- Left: Action icons -->
      <div class="flex items-center gap-2">
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
          title="เล่น"
          @click="handlePlay"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
          :class="isBookmarked ? 'bg-[#fbf8f3] text-[#cbbd93]' : ''"
          :title="isBookmarked ? 'เอาออกจากรายการโปรด' : 'บันทึกในรายการโปรด'"
          @click="toggleBookmark"
        >
          <svg v-if="!isBookmarked" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        </button>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
          :class="isCopied ? 'bg-green-100 text-green-500' : ''"
          :title="isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'"
          @click="handleCopy"
        >
          <svg v-if="!isCopied" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      <!-- Right: Share and report -->
      <div class="flex items-center gap-2">
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
          title="แชร์"
          @click="handleShare"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
            <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </svg>
        </button>
        <div class="relative">
          <button
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
            title="ตัวเลือกเพิ่มเติม"
            @click="toggleMenu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          <div
            v-if="showMenu"
            class="absolute top-full right-0 z-50 mt-1 min-w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <button
              class="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-3 text-left font-sans text-sm text-red-600 transition-colors duration-200 hover:bg-red-50"
              @click.stop="handleReport"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14a2 2 0 0 0 1.73 3h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
              รายงานปัญหา
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Arabic row -->
    <div class="px-4 py-2">
      <!-- QCF V2 glyph rendering (includes verse end marker) -->
      <QuranVerseText
        v-if="words && words.length > 0"
        :words="words"
        :is-font-loaded="isFontLoaded ?? (() => false)"
      />
      <!-- Fallback: plain unicode text -->
      <div
        v-else
        class="font-arabic rtl text-right text-3xl leading-loose text-slate-900"
        dir="rtl"
      >
        {{ verse.content }}
      </div>
    </div>

    <!-- Thai translation row -->
    <div class="px-4 py-2 pb-4">
      <div class="text-left font-sans text-lg leading-relaxed text-slate-600">
        {{ cleanTranslation }}
      </div>
      <!-- Footnotes (always visible when present) -->
      <ol
        v-if="verse.footnotes && verse.footnotes.length > 0"
        class="mt-3 space-y-1 pl-4 text-sm leading-relaxed text-slate-400"
      >
        <li v-for="fn in verse.footnotes" :key="fn.number">
          <span class="font-semibold text-slate-500">{{ fn.number }}.</span>
          {{ fn.text }}
        </li>
      </ol>
    </div>

    <!-- Separator line -->
    <div class="mx-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
  </div>
</template>
