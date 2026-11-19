<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { BookPage } from "~/composables/bookPagination";
import type { BookVerse } from "~/composables/useBookVerses";

interface SurahMeta {
  surahNumber: number;
  nameArabic: string;
  nameThai: string;
  revelationPlace: string;
  versesCount: number;
}

const props = defineProps<{
  page?: BookPage;
  side: "left" | "right";
  versesByKey: Map<string, BookVerse>;
  surah: SurahMeta;
  expandedFootnote: string | null;
}>();

defineEmits<{ toggleFootnote: [key: string] }>();

const rows = computed(() =>
  (props.page?.items ?? []).map((key, i) => ({
    key,
    verse: key === "header" ? undefined : props.versesByKey.get(key),
    footnoteStart: props.page!.footnoteStart[i]!,
  })),
);

const footnotes = computed(() =>
  rows.value.flatMap(row =>
    (row.verse?.footnotes ?? []).map((f, i) => ({ number: row.footnoteStart + i, text: f.text })),
  ),
);

const verseRange = computed(() => {
  const numbers = rows.value.flatMap(row => (row.verse ? [row.verse.verseNumber] : []));
  if (numbers.length === 0) return "";
  const first = numbers[0]!;
  const last = numbers[numbers.length - 1]!;
  return first === last ? `อายะห์ ${first}` : `อายะห์ ${first}–${last}`;
});

const overflow = computed(() => props.page?.overflow ?? false);

// Pagination reserves room for clamped footnotes; show them in full whenever the
// slack below the verses holds the whole text, and clamp only when it does not.
const footArea = ref<HTMLElement | null>(null);
const fitsInFull = ref(true);

async function measureFootnotes() {
  fitsInFull.value = true;
  await nextTick();
  const el = footArea.value;
  if (!el || overflow.value) return;
  fitsInFull.value = el.scrollHeight <= el.clientHeight + 1;
}

let footObserver: ResizeObserver | null = null;
onMounted(() => {
  // The area is flex-sized by the page, not by its content, so measuring can't loop
  footObserver = new ResizeObserver(() => measureFootnotes());
  if (footArea.value) footObserver.observe(footArea.value);
  measureFootnotes();
});
onBeforeUnmount(() => footObserver?.disconnect());
watch(footnotes, measureFootnotes);
watch(footArea, (el, old) => {
  if (old) footObserver?.unobserve(old);
  if (el) footObserver?.observe(el);
});
</script>

<template>
  <section :aria-label="verseRange" class="flex min-w-0 flex-1 flex-col px-[30px] pb-3.5 pt-5">
    <div
      class="flex h-6 shrink-0 items-center text-xs text-ink-muted"
      :class="side === 'right' ? 'justify-start' : 'justify-end'"
    >
      <span v-if="page">{{ surah.nameThai }}</span>
    </div>

    <div
      data-page-body
      class="flex min-h-0 flex-1 flex-col"
      :class="overflow ? 'scrollbar-dot overflow-y-auto' : 'overflow-hidden'"
      style="scrollbar-gutter: stable"
    >
      <div class="shrink-0">
        <template v-for="row in rows" :key="row.key">
          <BookSurahHeader v-if="row.key === 'header'" v-bind="surah" />
          <BookRow v-else-if="row.verse" :verse="row.verse" :footnote-start="row.footnoteStart" />
        </template>
      </div>

      <div
        v-if="footnotes.length"
        ref="footArea"
        class="flex flex-col"
        :class="overflow ? 'shrink-0' : 'scrollbar-dot min-h-0 flex-1 overflow-y-auto'"
      >
        <div class="mt-auto flex flex-col gap-[5px] pt-2">
          <BookFootnote
            v-for="f in footnotes"
            :key="f.number"
            data-footnote
            :number="f.number"
            :text="f.text"
            :expanded="fitsInFull || overflow || expandedFootnote === `${side}:${f.number}`"
            @toggle="$emit('toggleFootnote', `${side}:${f.number}`)"
          />
        </div>
      </div>
    </div>

    <div class="flex h-[26px] shrink-0 items-end justify-center text-xs text-ink-muted">{{ verseRange }}</div>
  </section>
</template>
