<script setup lang="ts">
import type { PwaStep } from '~/utils/pwaPlatform'

// The drawn screens above the numbered steps: each step shows for 3.2 s in turn, and a tap on a step shows its own.
const STEP_MS = 3200 // must match --animate-tap-ring in assets/css/main.css

const props = withDefaults(defineProps<{ steps: PwaStep[], browser: string, webApp?: boolean, fade?: boolean }>(), {
  webApp: false,
  fade: false,
})
const { t, te } = useI18n()

const current = ref(0)
// Bumped by a tap, so the turn restarts from the step picked and its picture plays from the start.
const round = ref(0)
const host = window.location.host
let timer: ReturnType<typeof setInterval> | undefined

function startTimer() {
  clearInterval(timer)
  // Under reduced motion the pictures stay put; a tap on a step still shows its picture.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => {
    current.value = (current.value + 1) % props.steps.length
  }, STEP_MS)
}

function pick(i: number) {
  current.value = i
  round.value++
  startTimer()
}

watch(() => props.steps.length, () => {
  current.value = 0
  startTimer()
})
onMounted(startTimer)
onBeforeUnmount(() => clearInterval(timer))

function part(step: PwaStep, name: 'pre' | 'btn' | 'post' | 'alt'): string {
  const key = `${step.key}.${name}`
  return te(key) ? t(key, { browser: props.browser }) : ''
}

// A button drawn as an icon only is named for screen readers.
function iconLabel(step: PwaStep): string {
  if (part(step, 'btn') || !step.icon || step.icon === 'app') return ''
  return t(`pwaInstall.iconLabel.${step.icon === 'plusSquare' ? 'add' : step.icon}`)
}
</script>

<template>
  <div
    aria-hidden="true"
    class="relative -mx-5 h-[248px] shrink-0 overflow-hidden bg-white"
    :class="fade ? '[mask-image:linear-gradient(to_bottom,transparent_0,#000_28px,#000_calc(100%_-_28px),transparent_100%)]' : ''"
  >
    <!-- Keyed by the turn as well, so the picture fades up and its ring restarts in step with the timer. -->
    <div
      :key="`${round}-${current}`"
      class="absolute inset-0 motion-safe:animate-step-in"
    >
      <PwaDemoFrame
        :kind="steps[current]!.frame"
        :host="host"
        :browser="browser"
        :web-app="webApp"
      />
    </div>
  </div>

  <ol class="mt-3 rounded-2xl bg-white px-1.5 py-1">
    <li
      v-for="(step, i) in steps"
      :key="step.key"
    >
      <button
        type="button"
        class="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left"
        :class="i === current ? 'bg-slate-100' : 'hover:bg-slate-50'"
        :aria-current="i === current ? 'step' : undefined"
        @click="pick(i)"
      >
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold"
          :class="i === current ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'"
        >{{ i + 1 }}</span>
        <span
          class="text-[0.9375rem] leading-[1.7]"
          :class="i === current ? 'font-semibold text-slate-900' : 'text-slate-500'"
        >
          {{ part(step, 'pre') }}
          <span
            v-if="part(step, 'btn') || step.icon"
            class="mx-0.5 inline-flex min-h-[26px] items-center gap-1.5 rounded-md bg-slate-200 px-2 align-middle leading-[1.6] font-semibold text-slate-900"
          >
            <img
              v-if="step.icon === 'app'"
              src="/icons/icon-192.png"
              alt=""
              class="size-[18px]"
            >
            <PwaIcon
              v-else-if="step.icon"
              :name="step.icon"
              class="size-4"
            />
            {{ part(step, 'btn') }}
            <span
              v-if="iconLabel(step)"
              class="sr-only"
            >{{ iconLabel(step) }}</span>
          </span>
          {{ part(step, 'post') }}
          <span
            v-if="part(step, 'alt')"
            class="mx-0.5 inline-flex min-h-[26px] items-center rounded-md bg-slate-200 px-2 align-middle leading-[1.6] font-semibold text-slate-900"
          >{{ part(step, 'alt') }}</span>
        </span>
      </button>
    </li>
  </ol>
</template>
