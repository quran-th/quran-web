<script setup lang="ts">
/**
 * Spotlight tour: dims the reader, cuts a hole around each step's target and
 * places a card next to it. Mount it only while the tour runs.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TourStep } from "~/composables/useReaderTour";

const props = defineProps<{ steps: TourStep[] }>();
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
      <div class="absolute inset-0" :class="hole ? '' : 'bg-[rgba(38,30,18,0.5)]'" />
      <div
        v-if="hole"
        aria-hidden="true"
        class="pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(38,30,18,0.5)] transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
        :style="{ top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` }"
      />

      <div
        ref="card"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-tour-title"
        aria-describedby="reader-tour-body"
        class="absolute w-[min(320px,calc(100vw-32px))] rounded-2xl outline-none bg-paper-pill p-5 text-ink shadow-menu transition-[top,left,opacity] duration-300 ease-out motion-reduce:transition-none [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-solid [&_button:focus-visible]:outline-sage-500/60"
        :class="cardSize.w ? 'opacity-100' : 'opacity-0'"
        :style="{ top: `${cardPosition.top}px`, left: `${cardPosition.left}px` }"
      >
        <div class="mb-3 flex items-center gap-1.5" aria-hidden="true">
          <span
            v-for="(_, i) in steps"
            :key="i"
            class="h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none"
            :class="i === index ? 'w-4 bg-sage-500' : 'w-1.5 bg-paper-tray'"
          />
          <span class="ml-auto text-xs tabular-nums text-ink-muted">{{ index + 1 }} / {{ steps.length }}</span>
        </div>
        <h2 id="reader-tour-title" class="text-base font-semibold text-ink-strong">{{ step?.title }}</h2>
        <p id="reader-tour-body" class="mt-1.5 text-sm leading-relaxed text-ink-soft">{{ step?.body }}</p>
        <div class="mt-4 flex items-center gap-2">
          <button
            v-if="!isLast"
            type="button"
            class="-ml-2 h-9 rounded-lg px-2 text-sm text-ink-muted hover:bg-paper-tint"
            @click="emit('finish')"
          >
            ข้าม
          </button>
          <button
            v-if="index > 0"
            type="button"
            class="ml-auto h-9 rounded-lg px-3 text-sm font-medium text-ink-icon hover:bg-paper-tint"
            @click="back"
          >
            ย้อนกลับ
          </button>
          <button
            type="button"
            class="h-9 rounded-lg bg-sage-600 px-4 text-sm font-semibold text-white hover:bg-sage-700"
            :class="{ 'ml-auto': index === 0 }"
            @click="next"
          >
            {{ isLast ? "เริ่มอ่าน" : "ถัดไป" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
