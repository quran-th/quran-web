<script setup lang="ts">
import { ref, computed } from "vue";
import type { QuranWord } from "~/types/quran";
import ReportModal from "~/components/reading/ReportModal.vue";

interface Footnote {
  number: number;
  text: string;
}

interface Verse {
  verseNumber: number;
  content: string;
  translation: string;
  footnotes?: Footnote[];
  isVerified?: boolean;
}

interface Props {
  verse: Verse;
  surahNumber: number;
  surahName?: string;
  words?: QuranWord[];
  isFontLoaded?: (pageNumber: number) => boolean;
  sourceId?: number;
  isExternalSource?: boolean;
  disableActions?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  play: [verse: Verse];
  bookmark: [verse: Verse];
  copy: [verse: Verse];
  share: [verse: Verse];
}>();

const isCopied = ref(false);
const isBookmarked = ref(false);
const showReportModal = ref(false);
const hoveredFootnote = ref<string | null>(null);

/** Split translation text to render (*N*) footnote markers as superscripts */
const translationParts = computed(() => {
  const parts: { type: "text" | "footnote"; value: string }[] = [];
  const text = props.verse?.translation || "";
  if (!text) return parts;

  const regex = /\(\*(\d+)\*\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: text.substring(lastIndex, match.index),
      });
    }
    parts.push({ type: "footnote", value: match[1] ?? "" });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.substring(lastIndex) });
  }

  return parts;
});

async function handleCopy() {
  try {
    const textToCopy = `${props.surahName || ""} (${props.surahNumber}:${props.verse.verseNumber})\n\n${props.verse.content}\n\n${props.verse.translation}`;
    await navigator.clipboard.writeText(textToCopy);
    isCopied.value = true;
    emit("copy", props.verse);
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function toggleBookmark() {
  isBookmarked.value = !isBookmarked.value;
  emit("bookmark", props.verse);
}

function handlePlay() {
  emit("play", props.verse);
}

function handleShare() {
  emit("share", props.verse);
}

function openReport() {
  showReportModal.value = true;
}
</script>

<template>
  <div class="relative">
    <!-- Actions row: action icons on left, share and report on right -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <!-- Left: Action icons -->
      <div class="flex items-center gap-2">
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200"
          :class="disableActions ? 'cursor-not-allowed opacity-30' : 'hover:bg-slate-100 hover:text-slate-500'"
          :disabled="disableActions"
          title="เล่น"
          @click="!disableActions && handlePlay()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200"
          :class="[
            disableActions ? 'cursor-not-allowed opacity-30' : 'hover:bg-slate-100 hover:text-slate-500',
            isBookmarked && !disableActions ? 'bg-[#fbf8f3] text-[#cbbd93]' : '',
          ]"
          :disabled="disableActions"
          :title="isBookmarked ? 'เอาออกจากรายการโปรด' : 'บันทึกในรายการโปรด'"
          @click="!disableActions && toggleBookmark()"
        >
          <svg
            v-if="!isBookmarked"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        </button>
        <button
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-500"
          :class="isCopied ? 'bg-green-100 text-green-500' : ''"
          :title="isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'"
          @click="handleCopy"
        >
          <svg
            v-if="!isCopied"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
            <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </svg>
        </button>
        <button
          v-if="!isExternalSource"
          class="flex items-center gap-1.5 rounded-lg bg-transparent px-2 py-1.5 text-sm text-slate-400 transition-all duration-200 hover:bg-amber-50 hover:text-amber-600"
          :title="$t('report.button_tooltip')"
          @click="openReport"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
          </svg>
          <span>{{ $t('report.button_message') }}</span>
        </button>
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
        class="font-arabic rtl text-right text-2xl sm:text-3xl leading-loose text-slate-900"
        dir="rtl"
      >
        {{ verse.content }}
      </div>
    </div>

    <!-- Thai translation row -->
    <div class="px-4 py-2 pb-4">
      <div class="text-left text-reading text-lg leading-relaxed text-slate-600">
        <template v-for="(part, index) in translationParts" :key="index">
          <sup
            v-if="part.type === 'footnote'"
            class="relative inline-flex items-center justify-center px-0.5 cursor-pointer transition-colors duration-200 rounded text-xs leading-none"
            :class="{
              'text-amber-700 bg-[#fcf9bf]': hoveredFootnote === part.value,
              'text-slate-600 hover:text-amber-700 hover:bg-[#fcf9bf]':
                hoveredFootnote !== part.value,
            }"
            @mouseenter="hoveredFootnote = part.value"
            @mouseleave="hoveredFootnote = null"
            @touchstart="hoveredFootnote = part.value"
            @touchend="hoveredFootnote = null"
          >
            {{ part.value }}
          </sup>
          <template v-else>{{ part.value }}</template>
        </template>
      </div>
      <!-- Footnotes (always visible when present) -->
      <ol
        v-if="verse.footnotes && verse.footnotes.length > 0"
        class="mt-3 space-y-1 pl-0 sm:pl-4 text-reading text-sm leading-relaxed text-slate-500"
      >
        <li
          v-for="fn in verse.footnotes"
          :key="fn.number"
          class="transition-colors duration-200 -ml-2 pl-2 py-1 rounded-r-md border-l-2"
          :class="{
            'bg-[#fcf9bf] border-amber-400 text-slate-800':
              hoveredFootnote === fn.number.toString(),
            'border-transparent hover:text-slate-600':
              hoveredFootnote !== fn.number.toString(),
          }"
          @mouseenter="hoveredFootnote = fn.number.toString()"
          @mouseleave="hoveredFootnote = null"
          @touchstart="hoveredFootnote = fn.number.toString()"
          @touchend="hoveredFootnote = null"
        >
          <span
            class="font-semibold transition-colors duration-200"
            :class="
              hoveredFootnote === fn.number.toString()
                ? 'text-amber-700'
                : 'text-slate-500'
            "
          >
            {{ fn.number }}.
          </span>
          {{ fn.text }}
        </li>
      </ol>
    </div>

    <!-- Separator line -->
    <div
      class="mx-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
    />

    <!-- Report Modal (hidden for external translation sources) -->
    <ReportModal
      v-if="!isExternalSource"
      :visible="showReportModal"
      :verse="verse"
      :surah-number="surahNumber"
      :surah-name="surahName"
      :source-id="sourceId"
      @update:visible="showReportModal = $event"
    />
  </div>
</template>
