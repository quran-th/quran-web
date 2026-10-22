<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRecitationStore } from "~/stores/recitationStore";
import { getReciterLabelTh } from "~/data/reciter-names-th";

const recitation = useRecitationStore();
const { status, activeVerseKey, reciterId, reciters } = storeToRefs(recitation);

const isReciterMenuOpen = ref(false);
const playerRef = ref<HTMLElement | null>(null);

const verseLabel = computed(() => {
  const verse = activeVerseKey.value?.split(":")[1];
  if (verse) return `อายะห์ ${verse}`;
  // Paused without an active verse = play() was blocked by autoplay policy
  return status.value === "loading" ? "กำลังโหลด…" : "แตะเพื่อเริ่มฟัง";
});

const currentReciterLabel = computed(() => {
  const reciter = reciters.value.find((r) => r.id === reciterId.value);
  return reciter ? getReciterLabelTh(reciter) : "";
});

function selectReciter(id: number) {
  recitation.setReciter(id);
  isReciterMenuOpen.value = false;
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!playerRef.value?.contains(e.target as Node)) {
    isReciterMenuOpen.value = false;
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") isReciterMenuOpen.value = false;
}

watch(status, (s) => {
  if (s === "idle") isReciterMenuOpen.value = false;
});

onMounted(() => {
  recitation.fetchReciters();
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-200 ease-out"
    leave-active-class="transition duration-150 ease-in"
  >
    <div
      v-if="status !== 'idle'"
      class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none"
    >
      <div ref="playerRef" class="pointer-events-auto relative w-full max-w-md">
        <!-- Reciter menu (opens upward, above the bar) -->
        <Transition
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="translate-y-2 opacity-0"
          enter-active-class="transition duration-150 ease-out"
          leave-active-class="transition duration-100 ease-in"
        >
          <div
            v-if="isReciterMenuOpen"
            class="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div class="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-400">
              เลือกผู้อ่าน
            </div>
            <ul role="listbox" aria-label="เลือกผู้อ่าน" class="max-h-72 overflow-y-auto py-1">
              <li
                v-for="r in reciters"
                :key="r.id"
                role="option"
                :aria-selected="r.id === reciterId"
              >
                <button
                  class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                  :class="r.id === reciterId ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'"
                  @click="selectReciter(r.id)"
                >
                  <span class="truncate">{{ getReciterLabelTh(r) }}</span>
                  <svg v-if="r.id === reciterId" class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
              </li>
            </ul>
          </div>
        </Transition>

        <div
          class="flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-1.5 pr-3 shadow-lg backdrop-blur-xs"
        >
          <button
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-colors hover:bg-slate-900"
            :title="status === 'playing' ? 'หยุดชั่วคราว' : 'เล่นต่อ'"
            @click="recitation.togglePause()"
          >
            <svg v-if="status === 'loading'" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            <svg v-else-if="status === 'playing'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
          </button>

          <button
            class="group flex min-w-0 flex-1 flex-col items-start text-left"
            aria-haspopup="listbox"
            :aria-expanded="isReciterMenuOpen"
            @click="isReciterMenuOpen = !isReciterMenuOpen"
          >
            <span class="text-sm font-medium text-slate-700">{{ verseLabel }}</span>
            <span class="flex w-full items-center gap-1 text-xs text-slate-400 transition-colors group-hover:text-slate-600">
              <span class="truncate">{{ currentReciterLabel }}</span>
              <svg class="shrink-0 transition-transform" :class="isReciterMenuOpen && 'rotate-180'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            </span>
          </button>

          <button
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="ปิด"
            @click="recitation.stop()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
