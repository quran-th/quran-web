<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRecitationStore, PLAYBACK_SPEEDS, MAX_REPEAT, MAX_PAUSE_SECONDS } from "~/stores/recitationStore";
import { getReciterLabelTh } from "~/data/reciter-names-th";
import WheelPicker from "~/components/reading/WheelPicker.vue";

const recitation = useRecitationStore();
const { status, activeVerseKey, reciterId, reciters, playbackRate, repeatCount, pauseSeconds } =
  storeToRefs(recitation);

type SettingsView = "root" | "qari" | "play";
const settingsView = ref<SettingsView | null>(null);
const speedOptions = PLAYBACK_SPEEDS.map((v) => ({ value: v as number, label: `${v}x` }));
const repeatOptions = Array.from({ length: MAX_REPEAT }, (_, i) => ({ value: i + 1, label: `${i + 1}x` }));
const pauseOptions = Array.from({ length: MAX_PAUSE_SECONDS + 1 }, (_, i) => ({
  value: i,
  label: i === 0 ? "ปิด" : `${i} วิ`,
}));

type PlayFieldKey = "speed" | "repeat" | "pause";
const openField = ref<PlayFieldKey | null>(null);

interface PlayField {
  key: PlayFieldKey;
  title: string;
  value: number;
  options: { value: number; label: string }[];
  set: (value: number) => void;
}

const playFields = computed(() => {
  const fields: PlayField[] = [
    { key: "speed", title: "ความเร็ว", value: playbackRate.value, options: speedOptions, set: recitation.setPlaybackRate },
    { key: "repeat", title: "อ่านซ้ำแต่ละอายะห์", value: repeatCount.value, options: repeatOptions, set: recitation.setRepeatCount },
    { key: "pause", title: "หยุดพักหลังแต่ละอายะห์", value: pauseSeconds.value, options: pauseOptions, set: recitation.setPauseSeconds },
  ];
  return fields.map((f) => ({
    ...f,
    valueLabel: f.options.find((o) => o.value === f.value)?.label ?? "",
  }));
});

const playSummary = computed(() => {
  const parts = [`${playbackRate.value}x`];
  if (repeatCount.value > 1) parts.push(`ซ้ำ ${repeatCount.value} รอบ`);
  if (pauseSeconds.value > 0) parts.push(`เว้น ${pauseSeconds.value} วิ`);
  return parts.join(" · ");
});

function toggleSettings(view: SettingsView) {
  settingsView.value = settingsView.value === view ? null : view;
}
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
  settingsView.value = null;
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!playerRef.value?.contains(e.target as Node)) {
    settingsView.value = null;
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") settingsView.value = null;
}

watch(settingsView, () => {
  openField.value = null;
});

watch(status, (s) => {
  if (s === "idle") settingsView.value = null;
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
        <!-- Mobile only: dims the page behind the bottom sheet -->
        <Transition
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          enter-active-class="transition-opacity duration-200"
          leave-active-class="transition-opacity duration-150"
        >
          <div
            v-if="settingsView"
            class="fixed inset-0 z-40 bg-slate-900/40 sm:hidden"
            @click="settingsView = null"
          />
        </Transition>

        <!-- Settings: bottom sheet on mobile, floating panel above the bar on desktop -->
        <Transition
          enter-from-class="translate-y-full sm:translate-y-2 sm:opacity-0"
          leave-to-class="translate-y-full sm:translate-y-2 sm:opacity-0"
          enter-active-class="transition duration-250 ease-out"
          leave-active-class="transition duration-200 ease-in"
        >
          <div
            v-if="settingsView"
            class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:absolute sm:bottom-full sm:mb-2 sm:max-h-none sm:overflow-hidden sm:rounded-2xl sm:border sm:pb-0 sm:shadow-xl"
          >
            <div class="flex justify-center pb-1 pt-2.5 sm:hidden">
              <span class="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <template v-if="settingsView === 'root'">
              <div class="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-400">ตั้งค่า</div>
              <button
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                @click="settingsView = 'qari'"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-slate-700">ผู้อ่าน</span>
                  <span class="block truncate text-xs text-slate-400">{{ currentReciterLabel }}</span>
                </span>
                <svg class="shrink-0 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <button
                class="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                @click="settingsView = 'play'"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-slate-700">ตัวเลือกการเล่น</span>
                  <span class="block truncate text-xs text-slate-400">{{ playSummary }}</span>
                </span>
                <svg class="shrink-0 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </template>

            <template v-else>
              <button
                class="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                @click="settingsView = 'root'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                {{ settingsView === "qari" ? "เลือกผู้อ่าน" : "ตัวเลือกการเล่น" }}
              </button>

              <ul v-if="settingsView === 'qari'" role="listbox" aria-label="เลือกผู้อ่าน" class="max-h-72 overflow-y-auto py-1">
                <li v-for="r in reciters" :key="r.id" role="option" :aria-selected="r.id === reciterId">
                  <button
                    class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                    :class="r.id === reciterId ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'"
                    @click="selectReciter(r.id)"
                  >
                    <span class="min-w-0 truncate">{{ getReciterLabelTh(r) }}</span>
                    <span class="flex shrink-0 items-center gap-2">
                      <span
                        v-if="r.hasWordTimings"
                        class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                      >ไฮไลต์ทีละคำ</span>
                      <svg v-if="r.id === reciterId" class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  </button>
                </li>
              </ul>

              <div v-else class="divide-y divide-slate-100">
                <div v-for="field in playFields" :key="field.key">
                  <button
                    class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    :aria-expanded="openField === field.key"
                    @click="openField = openField === field.key ? null : field.key"
                  >
                    <span class="text-sm font-medium text-slate-700">{{ field.title }}</span>
                    <span
                      class="rounded-lg px-2.5 py-1 text-sm tabular-nums transition-colors"
                      :class="openField === field.key ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'"
                    >{{ field.valueLabel }}</span>
                  </button>
                  <div v-if="openField === field.key" class="relative px-4 pb-2">
                    <div class="pointer-events-none absolute inset-x-4 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-slate-100" />
                    <WheelPicker
                      class="relative"
                      :label="field.title"
                      :model-value="field.value"
                      :options="field.options"
                      @update:model-value="field.set"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </Transition>

        <div
          class="flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 py-2.5 pl-2.5 pr-2.5 shadow-lg backdrop-blur-xs"
        >
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition-colors hover:bg-slate-900"
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
            :aria-expanded="settingsView === 'qari'"
            @click="toggleSettings('qari')"
          >
            <span class="text-sm font-medium text-slate-700">{{ verseLabel }}</span>
            <span class="flex w-full items-center gap-1 text-xs text-slate-400 transition-colors group-hover:text-slate-600">
              <span class="truncate">{{ currentReciterLabel }}</span>
              <svg class="shrink-0 transition-transform" :class="settingsView === 'qari' && 'rotate-180'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            </span>
          </button>

          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            :class="settingsView && 'bg-slate-100 text-slate-700'"
            title="ตั้งค่า"
            aria-label="ตั้งค่า"
            :aria-expanded="!!settingsView"
            @click="toggleSettings('root')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="7" y2="7" /><line x1="4" x2="20" y1="17" y2="17" /><circle cx="9" cy="7" r="2.5" fill="white" /><circle cx="15" cy="17" r="2.5" fill="white" /></svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
