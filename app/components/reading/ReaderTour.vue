<script setup lang="ts">
/**
 * Spotlight tour: dims the reader, cuts a hole around each step's target and
 * places a card next to it. Mount it only while the tour runs.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TourStep } from "~/composables/useReaderTour";

const props = defineProps<{
  steps: TourStep[];
  /** Only the steps released since the reader's last tour, so they are flagged as new */
  isUpdate?: boolean;
}>();
const emit = defineEmits<{ finish: [] }>();

const HOLE_PADDING = 6;
const CARD_GAP = 12;
const EDGE = 16;

const index = ref(0);
const step = computed(() => props.steps[index.value]);
const isLast = computed(() => index.value === props.steps.length - 1);

const card = ref<HTMLElement | null>(null);
const targetRect = ref<DOMRect | null>(null);
const viewport = ref({ w: 0, h: 0 });
const cardSize = ref({ w: 0, h: 0 });

// The header renders a wide and a phone copy of its buttons; only one is on screen
function findTarget(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
    .find(el => el.getClientRects().length > 0) ?? null;
}

let resizeObserver: ResizeObserver | null = null;
let observed: HTMLElement | null = null;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

function measure() {
  const el = step.value ? findTarget(step.value.target) : null;
  if (el !== observed) {
    if (observed) resizeObserver?.unobserve(observed);
    if (el) resizeObserver?.observe(el);
    observed = el;
  }
  targetRect.value = el?.getBoundingClientRect() ?? null;
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  if (card.value) cardSize.value = { w: card.value.offsetWidth, h: card.value.offsetHeight };
}

const hole = computed(() => {
  const r = targetRect.value;
  if (!r) return null;
  const { w: vw, h: vh } = viewport.value;
  const top = Math.max(2, r.top - HOLE_PADDING);
  const left = Math.max(2, r.left - HOLE_PADDING);
  const bottom = Math.min(vh - 2, r.bottom + HOLE_PADDING);
  const right = Math.min(vw - 2, r.right + HOLE_PADDING);
  return { top, left, width: right - left, height: bottom - top };
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Below, above, then beside the target; a target too big for any of those (a whole
// page) gets the card low on the screen, leaning toward the side with more free space
const cardPosition = computed(() => {
  const { w: vw, h: vh } = viewport.value;
  const { w: cw, h: ch } = cardSize.value;
  const h = hole.value;
  if (!h) return { left: (vw - cw) / 2, top: (vh - ch) / 2 };

  const centredLeft = clamp(h.left + h.width / 2 - cw / 2, EDGE, vw - cw - EDGE);
  const centredTop = clamp(h.top + h.height / 2 - ch / 2, EDGE, vh - ch - EDGE);
  if (h.top + h.height + CARD_GAP + ch <= vh - EDGE) return { left: centredLeft, top: h.top + h.height + CARD_GAP };
  if (h.top - CARD_GAP - ch >= EDGE) return { left: centredLeft, top: h.top - CARD_GAP - ch };
  if (h.left - CARD_GAP - cw >= EDGE) return { left: h.left - CARD_GAP - cw, top: centredTop };
  if (h.left + h.width + CARD_GAP + cw <= vw - EDGE) return { left: h.left + h.width + CARD_GAP, top: centredTop };
  const spaceRight = vw - (h.left + h.width);
  const sideLeft = spaceRight > h.left ? vw - cw - EDGE : EDGE;
  return { left: Math.abs(spaceRight - h.left) < EDGE ? (vw - cw) / 2 : sideLeft, top: vh - ch - EDGE * 2 };
});

async function showStep() {
  measure();
  await nextTick();
  measure();
  // The card takes focus, not its button: a programmatic focus on the button would
  // paint a focus ring that nobody asked for. Enter still advances from the card.
  card.value?.focus();
  // The spread sheet animates its width and position for 300ms; measure again once it rests
  clearTimeout(settleTimer);
  settleTimer = setTimeout(measure, 350);
}

function next() {
  if (isLast.value) emit("finish");
  else index.value++;
}

function back() {
  if (index.value > 0) index.value--;
}

watch(index, showStep);

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("finish");
    return;
  }
  if (e.key === "Enter" && document.activeElement === card.value) {
    e.preventDefault();
    next();
    return;
  }
  if (e.key !== "Tab" || !card.value) return;
  const buttons = Array.from(card.value.querySelectorAll<HTMLElement>("button"));
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (!first || !last) return;
  if (e.shiftKey && (document.activeElement === first || document.activeElement === card.value)) {
    e.preventDefault();
    last.focus();
  }
  else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
  else if (!card.value.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}

onMounted(() => {
  // Fetched up front so an image step opens complete rather than filling in
  for (const s of props.steps) {
    if (s.image) new Image().src = s.image.src;
  }
  resizeObserver = new ResizeObserver(measure);
  if (card.value) resizeObserver.observe(card.value);
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", measure, true);
  window.addEventListener("keydown", handleKeydown);
  showStep();
});

onBeforeUnmount(() => {
  clearTimeout(settleTimer);
  resizeObserver?.disconnect();
  window.removeEventListener("resize", measure);
  window.removeEventListener("scroll", measure, true);
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60]" @touchstart.stop @touchend.stop>
      <!-- Blocks the reader underneath; the tour is the only thing to press -->
      <div class="absolute inset-0" :class="hole ? '' : 'bg-[rgba(30,25,18,0.42)]'" />
      <div
        v-if="hole"
        aria-hidden="true"
        class="pointer-events-none absolute rounded-[14px] shadow-[0_0_0_9999px_rgba(30,25,18,0.42)] outline-[1.5px] outline-solid outline-paper-pill/70 transition-[top,left,width,height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        :style="{ top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` }"
      />

      <div
        ref="card"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-tour-title"
        aria-describedby="reader-tour-body"
        class="absolute overflow-hidden rounded-[20px] bg-paper-pill text-ink outline-none ring-1 ring-[rgba(60,45,25,0.08)] shadow-[0_1px_2px_rgba(60,45,25,0.06),0_24px_56px_-12px_rgba(60,45,25,0.3)] transition-[top,left,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-solid [&_button:focus-visible]:outline-sage-500/60"
        :class="[cardSize.w ? 'opacity-100' : 'opacity-0', step?.image ? 'w-[min(420px,calc(100vw-32px))] 2xl:w-[520px]' : 'w-[min(340px,calc(100vw-32px))]']"
        :style="{ top: `${cardPosition.top}px`, left: `${cardPosition.left}px` }"
      >
        <div aria-hidden="true" class="h-[2px] bg-paper-tray/50">
          <div
            class="h-full bg-ink-strong transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            :style="{ width: `${((index + 1) / steps.length) * 100}%` }"
          />
        </div>

        <div class="px-6 pb-5 pt-5">
          <p aria-hidden="true" class="flex items-center gap-2 text-[11px] font-medium tabular-nums tracking-[0.16em] text-ink-muted">
            <span v-if="isUpdate" class="rounded-full bg-sage-wash px-2 py-0.5 tracking-normal text-sage-700">ใหม่</span>
            <span>{{ String(index + 1).padStart(2, "0") }}<span class="text-ink-muted/50"> / {{ String(steps.length).padStart(2, "0") }}</span></span>
          </p>
          <Transition
            mode="out-in"
            enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
            enter-from-class="translate-y-1 opacity-0"
            leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
            leave-to-class="opacity-0"
          >
            <div :key="index">
              <div v-if="step?.image" class="mt-3 rounded-xl bg-paper-surround p-1.5">
                <img
                  :src="step.image.src"
                  :alt="step.image.alt"
                  width="1052"
                  height="610"
                  class="block aspect-[1052/610] h-auto w-full rounded-lg shadow-pill"
                >
              </div>
              <h2 id="reader-tour-title" class="text-[17px] font-semibold tracking-tight text-ink-strong" :class="step?.image ? 'mt-4' : 'mt-2.5'">{{ step?.title }}</h2>
              <p id="reader-tour-body" class="mt-2 break-keep text-sm leading-[1.75] text-ink-icon">{{ step?.body }}</p>
            </div>
          </Transition>

          <div class="mt-6 flex items-center gap-2">
            <button
              v-if="!isLast"
              type="button"
              class="-ml-1 h-9 rounded-full px-1 text-[13px] text-ink-muted transition-colors hover:text-ink-strong"
              @click="emit('finish')"
            >
              ข้าม
            </button>
            <button
              v-if="index > 0"
              type="button"
              aria-label="ย้อนกลับ"
              class="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-icon ring-1 ring-paper-tray transition-colors hover:bg-paper-tint hover:text-ink-strong"
              @click="back"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              class="h-9 rounded-full bg-ink-strong px-5 text-[13px] font-medium text-paper-pill transition-colors hover:bg-ink-soft"
              :class="{ 'ml-auto': index === 0 }"
              @click="next"
            >
              {{ isLast ? "เริ่มอ่าน" : "ถัดไป" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
