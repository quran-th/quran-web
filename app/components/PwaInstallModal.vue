<script setup lang="ts">
import type { PwaStep } from '~/utils/pwaPlatform'

// A small badge slides up offering the app (at most once per 3 days). On a phone its button opens a bottom sheet:
// Android with Chrome's install prompt gets a one-tap install over a drawn home screen; iPhone, LINE/Facebook and
// Android browsers without a prompt get nara-flood's drawn walkthrough. Desktop goes straight to the browser's prompt.

const { t } = useI18n()
const { canShow, platform, installed, hasDeferredPrompt, promptWaitLeft, noteShown, promptInstall, dismiss } = usePwaInstall()

const sheetOpen = ref(false)
const sheet = ref<HTMLDialogElement | null>(null)

watch(canShow, (shown) => {
  if (shown) noteShown()
}, { immediate: true })

async function onBadgeInstall() {
  if (platform.value.kind === 'desktop') {
    await promptInstall()
    dismiss()
    return
  }
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  dismiss()
}

watch(sheetOpen, async (open) => {
  const root = document.documentElement
  if (!open) {
    if (sheet.value?.open) sheet.value.close()
    root.style.overflow = ''
    return
  }
  await nextTick()
  if (sheet.value && !sheet.value.open) sheet.value.showModal()
  // The heading takes focus, not the close button the browser would pick.
  sheet.value?.querySelector<HTMLElement>('#pwa-sheet-title')?.focus()
  root.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
})

// Android: Chrome hands over its prompt some time after load. Until then the button waits ("preparing"); after
// promptWaitLeft() it gives up and the menu steps take over. A prompt that arrives later brings the button back.
const waited = ref(false)
let waitTimer: ReturnType<typeof setTimeout> | undefined
watch(sheetOpen, (open) => {
  clearTimeout(waitTimer)
  if (!open || platform.value.kind !== 'android') return
  const left = platform.value.prompts ? promptWaitLeft() : 0
  waited.value = left === 0
  if (left > 0) waitTimer = setTimeout(() => (waited.value = true), left)
})
onBeforeUnmount(() => clearTimeout(waitTimer))

const asking = ref(false)
async function androidAdd() {
  asking.value = true
  const outcome = await promptInstall()
  asking.value = false
  if (outcome === 'dismissed') closeSheet()
  else if (outcome === 'unavailable') waited.value = true
}

// Chrome's prompt is spent the moment it opens, so while it is on screen (asking) the button page stays put.
const androidSteps = computed(() => platform.value.kind === 'android' && !hasDeferredPrompt.value && !asking.value && !installed.value && waited.value)

const steps = computed<PwaStep[]>(() => {
  const p = platform.value
  if (p.kind === 'ios') {
    // Safari 26 keeps แชร์ in the ⋯ menu; earlier Safari has a share button on its bottom bar; other browsers on
    // iPhone (Chrome and the like) have one in the address bar. From the share sheet on, every browser is the same.
    const first: PwaStep[] = !p.safari
      ? [{ key: 'pwaInstall.ios.shareAddress', icon: 'share', frame: 'addressShare' }]
      : p.menuInMore
        ? [
            { key: 'pwaInstall.ios.more', icon: 'more', frame: 'safariMore' },
            { key: 'pwaInstall.ios.share', icon: 'share', frame: 'moreMenu' },
          ]
        : [{ key: 'pwaInstall.ios.shareBar', icon: 'share', frame: 'safariShareBar' }]
    return [
      ...first,
      { key: 'pwaInstall.ios.addHome', icon: 'plusSquare', frame: 'shareSheet' },
      { key: 'pwaInstall.ios.add', frame: 'confirm' },
      { key: 'pwaInstall.ios.open', icon: 'app', frame: 'home' },
    ]
  }
  if (p.kind === 'in-app') {
    return [
      { key: 'pwaInstall.inApp.menu', icon: 'moreVertical', frame: 'inAppBar' },
      { key: 'pwaInstall.inApp.open', frame: 'inAppMenu' },
      { key: 'pwaInstall.inApp.next', frame: 'opened' },
    ]
  }
  return [
    { key: 'pwaInstall.android.menu', icon: 'moreVertical', frame: 'chromeBar' },
    { key: 'pwaInstall.android.install', icon: 'plusSquare', frame: 'chromeMenu' },
    { key: 'pwaInstall.android.open', icon: 'app', frame: 'home' },
  ]
})

const browser = computed(() => {
  const p = platform.value
  if (p.kind === 'in-app') return p.browser
  return p.kind === 'ios' ? 'Safari' : 'Chrome'
})

// In-app browsers (LINE, Facebook) may lack the clipboard API or refuse it: fall back to the old copy command, and
// failing that, show the link to copy by hand.
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const copyHost = ref<HTMLDivElement | null>(null)
const pageLink = window.location.href.replace(/[?&]pwa=[^&]*/, '')
async function copyLink() {
  const link = pageLink
  try {
    await navigator.clipboard.writeText(link)
    copyState.value = 'copied'
    return
  }
  catch {
    // fall through to execCommand
  }
  // The textarea goes inside the dialog: outside it, the modal dialog keeps it from being selected.
  const field = document.createElement('textarea')
  field.value = link
  field.setAttribute('readonly', '')
  field.className = 'fixed top-0 left-0 opacity-0'
  copyHost.value?.appendChild(field)
  field.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  }
  catch {
    copied = false
  }
  field.remove()
  copyState.value = copied ? 'copied' : 'failed'
}
</script>

<template>
  <Transition name="pwa-slide-up">
    <div
      v-if="canShow && !sheetOpen"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:justify-start lg:px-8 lg:pb-8"
      role="dialog"
      aria-modal="false"
      :aria-label="t('pwaInstall.badge.title')"
    >
      <div class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border border-slate-200 bg-white/95 py-1.5 pr-1.5 pl-1.5 shadow-lg backdrop-blur">
        <img
          src="/icons/icon-192.png"
          alt=""
          class="size-10 shrink-0"
        >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-900">
            {{ t('pwaInstall.badge.title') }}
          </p>
          <p class="truncate text-[11px] leading-snug text-slate-500">
            {{ t('pwaInstall.badge.description') }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
          @click="onBadgeInstall"
        >
          {{ t('pwaInstall.badge.install') }}
        </button>
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          :aria-label="t('pwaInstall.dismissLabel')"
          @click="dismiss"
        >
          <PwaIcon
            name="close"
            class="size-4"
          />
        </button>
      </div>
    </div>
  </Transition>

  <dialog
    v-if="sheetOpen"
    ref="sheet"
    aria-labelledby="pwa-sheet-title"
    class="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[94dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border-0 bg-slate-100 p-0 text-slate-900 backdrop:bg-black/40 motion-safe:animate-step-in"
    @cancel.prevent="closeSheet"
    @click.self="closeSheet"
  >
    <div class="flex flex-col px-5 pt-2">
      <div
        aria-hidden="true"
        class="mx-auto h-1.5 w-10 rounded-full bg-slate-300"
      />
      <div class="mt-3 flex items-center gap-2.5">
        <img
          src="/icons/icon-192.png"
          alt=""
          class="size-8"
        >
        <span class="flex-1 text-sm font-medium text-slate-500">{{ t('pwaInstall.appName') }}</span>
        <button
          type="button"
          class="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-200"
          :aria-label="t('pwaInstall.dismissLabel')"
          @click="closeSheet"
        >
          <PwaIcon
            name="close"
            class="size-5"
          />
        </button>
      </div>

      <!-- Android with Chrome's own prompt: one tap installs. -->
      <template v-if="platform.kind === 'android' && !androidSteps">
        <div
          aria-hidden="true"
          class="mt-4 grid w-[232px] grid-cols-4 gap-4 self-center"
        >
          <template
            v-for="i in 4"
            :key="i"
          >
            <div
              v-if="i === 4"
              class="relative aspect-square"
            >
              <PwaTapRing round="rounded-[1.1rem]" />
              <img
                src="/icons/icon-192.png"
                alt=""
                class="absolute inset-0 size-full motion-safe:animate-icon-pop"
              >
            </div>
            <div
              v-else
              class="aspect-square rounded-xl bg-white"
            />
          </template>
        </div>
        <h2
          id="pwa-sheet-title"
          tabindex="-1"
          class="mt-5 text-center text-xl leading-snug font-semibold text-balance outline-none"
        >
          {{ t('pwaInstall.title') }}
        </h2>
        <p class="mt-1.5 text-center text-sm leading-relaxed text-slate-500">
          {{ t('pwaInstall.lead') }}
        </p>
        <ul class="mt-4 rounded-2xl bg-white px-4 py-1">
          <li
            v-for="[icon, key] in ([['zap', 'fast'], ['maximize', 'fullscreen'], ['refresh', 'updates']] as const)"
            :key="key"
            class="flex min-h-12 items-center gap-3 text-[0.9375rem]"
          >
            <PwaIcon
              :name="icon"
              class="size-5 shrink-0 text-slate-500"
            />
            {{ t(`pwaInstall.android.${key}`) }}
          </li>
        </ul>
        <div class="sticky bottom-0 -mx-5 mt-5 flex flex-col gap-1 bg-slate-100 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <template v-if="installed">
            <p
              role="status"
              class="flex items-start gap-3 rounded-2xl bg-white px-4 py-3"
            >
              <span class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <PwaIcon
                  name="check"
                  class="size-4"
                />
              </span>
              <span class="min-w-0">
                <span class="block font-semibold">{{ t('pwaInstall.android.done') }}</span>
                <span class="mt-0.5 block text-sm text-slate-500">{{ t('pwaInstall.android.doneHint') }}</span>
              </span>
            </p>
            <button
              type="button"
              class="h-12 rounded-xl text-[0.9375rem] font-medium text-slate-500 hover:text-slate-900"
              @click="closeSheet"
            >
              {{ t('pwaInstall.close') }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="flex h-13 items-center justify-center gap-2.5 rounded-xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              :disabled="asking || !hasDeferredPrompt"
              @click="androidAdd"
            >
              <template v-if="hasDeferredPrompt || asking">
                <PwaIcon
                  name="download"
                  class="size-5"
                />
                {{ t('pwaInstall.android.add') }}
              </template>
              <span
                v-else
                role="status"
                class="contents"
              >
                <span
                  aria-hidden="true"
                  class="size-4.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
                />
                {{ t('pwaInstall.android.preparing') }}
              </span>
            </button>
            <button
              type="button"
              class="h-12 rounded-xl text-[0.9375rem] font-medium text-slate-500 hover:text-slate-900"
              @click="closeSheet"
            >
              {{ t('pwaInstall.later') }}
            </button>
          </template>
        </div>
      </template>

      <!-- Everyone else: the drawn walkthrough. -->
      <template v-else>
        <h2
          id="pwa-sheet-title"
          tabindex="-1"
          class="mt-3 text-xl leading-snug font-semibold text-balance outline-none"
        >
          {{ platform.kind === 'in-app' ? t('pwaInstall.inApp.title', { browser }) : t('pwaInstall.title') }}
        </h2>
        <p class="mt-1 mb-3 text-sm leading-relaxed text-slate-500">
          {{ platform.kind === 'in-app' ? t('pwaInstall.inApp.lead') : t('pwaInstall.lead') }}
        </p>
        <PwaWalkthrough
          :steps="steps"
          :browser="browser"
          :web-app="platform.kind === 'ios' && platform.menuInMore"
          :fade="platform.kind === 'in-app'"
        />
        <div
          ref="copyHost"
          class="sticky bottom-0 -mx-5 mt-4 flex flex-col gap-2 bg-slate-100 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <template v-if="platform.kind === 'in-app'">
            <p
              aria-live="polite"
              class="text-center text-sm leading-normal"
              :class="copyState === 'idle' ? 'text-slate-500' : 'text-slate-900'"
            >
              <template v-if="copyState === 'copied'">
                {{ t('pwaInstall.inApp.copied', { browser }) }}
              </template>
              <template v-else-if="copyState === 'failed'">
                {{ t('pwaInstall.inApp.copyFailed') }}
                <span class="mt-1 block font-medium break-all select-all">{{ pageLink }}</span>
              </template>
              <template v-else>
                {{ t('pwaInstall.inApp.copyHint', { browser }) }}
              </template>
            </p>
            <button
              type="button"
              class="flex h-13 items-center justify-center gap-2.5 rounded-xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800"
              @click="copyLink"
            >
              <PwaIcon
                name="copy"
                class="size-5"
              />
              {{ t('pwaInstall.inApp.copy') }}
            </button>
          </template>
          <button
            type="button"
            class="h-12 rounded-xl text-[0.9375rem] font-medium text-slate-500 hover:text-slate-900"
            @click="closeSheet"
          >
            {{ t('pwaInstall.later') }}
          </button>
        </div>
      </template>
    </div>
  </dialog>
</template>

<style scoped>
.pwa-slide-up-enter-active,
.pwa-slide-up-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 0.25s ease;
}

.pwa-slide-up-enter-from,
.pwa-slide-up-leave-to {
  transform: translateY(40px);
  opacity: 0;
}
</style>
