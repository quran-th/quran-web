<script setup lang="ts">
// Drawings of the phone's own screens above each install step, with a gold ring on the button to tap. Hidden from
// screen readers: the numbered steps below say the same. Ported from nara-flood's install guide (components/install/demo.tsx).

import type { PwaFrameKind } from '~/utils/pwaPlatform'

defineProps<{ kind: PwaFrameKind, host: string, browser: string, webApp: boolean }>()
const { t } = useI18n()

// iOS's own control colours, kept only inside these drawings so the picture looks like the person's phone.
const IOS_BAR = 'bg-[#F2F2F7]'
const IOS_ICON = 'text-[#1C1C1E]'
const IOS_BLUE = 'text-[#0A5BC4]'
const IOS_GREEN = 'bg-[#34C759]'
const APP_ICON = '/icons/icon-512.png'
</script>

<template>
  <div
    v-if="kind === 'safariMore'"
    class="absolute inset-0 bg-white"
  >
    <PwaDemoLines class="inset-x-9 top-8" />
    <div
      class="absolute inset-x-8 bottom-8 flex h-13 items-center gap-2 rounded-full px-2"
      :class="IOS_BAR"
    >
      <span class="grid size-9 place-items-center"><PwaIcon
        name="chevronLeft"
        class="size-5"
        :class="IOS_ICON"
      /></span>
      <span class="grid h-9 min-w-0 flex-1 place-items-center rounded-full bg-white px-3 text-[0.8125rem] text-slate-500">
        <span class="truncate">{{ host }}</span>
      </span>
      <span class="relative grid size-9 place-items-center">
        <PwaIcon
          name="more"
          class="size-5.5"
          :class="IOS_ICON"
        />
        <PwaTapRing />
      </span>
    </div>
  </div>

  <div
    v-else-if="kind === 'moreMenu'"
    class="absolute inset-0 bg-slate-100"
  >
    <div class="absolute right-[34px] bottom-[96px] w-[210px] overflow-hidden rounded-2xl bg-white">
      <div class="relative flex h-[46px] items-center justify-between border-b border-slate-200 bg-amber-50 px-3.5 text-[0.9375rem] font-semibold">
        {{ t('pwaInstall.ios.share.btn') }}
        <PwaIcon
          name="share"
          class="size-5"
          :class="IOS_ICON"
        />
        <PwaTapRing inset="-top-px right-0 size-12" />
      </div>
      <div class="flex h-11 items-center border-b border-slate-200 px-3.5 text-[0.9375rem] text-slate-500">
        {{ t('pwaInstall.ios.demo.bookmark') }}
      </div>
      <div class="flex h-11 items-center px-3.5 text-[0.9375rem] text-slate-500">
        {{ t('pwaInstall.ios.demo.find') }}
      </div>
    </div>
    <div class="absolute inset-x-8 bottom-8 h-13 rounded-full bg-slate-200" />
  </div>

  <div
    v-else-if="kind === 'safariShareBar'"
    class="absolute inset-0 bg-white"
  >
    <PwaDemoLines
      class="inset-x-9 top-8"
      short
    />
    <div
      class="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pt-2.5 pb-5"
      :class="IOS_BAR"
    >
      <span class="grid h-9 place-items-center rounded-lg bg-white text-[0.8125rem] text-slate-500">{{ host }}</span>
      <div
        class="flex items-center justify-around"
        :class="IOS_ICON"
      >
        <span class="grid size-9 place-items-center"><PwaIcon
          name="chevronLeft"
          class="size-5"
        /></span>
        <span class="grid size-9 place-items-center opacity-40"><PwaIcon
          name="chevronRight"
          class="size-5"
        /></span>
        <span class="relative grid size-9 place-items-center">
          <PwaIcon
            name="share"
            class="size-5.5"
          />
          <PwaTapRing />
        </span>
        <span class="grid size-9 place-items-center"><PwaIcon
          name="copy"
          class="size-5"
        /></span>
      </div>
    </div>
  </div>

  <div
    v-else-if="kind === 'addressShare'"
    class="absolute inset-0 bg-white"
  >
    <div
      class="absolute inset-x-6 top-8 flex h-13 items-center gap-2 rounded-2xl pr-2 pl-4"
      :class="IOS_BAR"
    >
      <span class="min-w-0 flex-1 truncate text-[0.8125rem] text-slate-500">{{ host }}</span>
      <span class="relative grid size-9 place-items-center">
        <PwaIcon
          name="share"
          class="size-5.5"
          :class="IOS_ICON"
        />
        <PwaTapRing />
      </span>
    </div>
    <PwaDemoLines
      class="inset-x-10 top-26"
      short
    />
  </div>

  <div
    v-else-if="kind === 'shareSheet'"
    class="absolute inset-0 flex flex-col gap-3 px-[34px] py-8"
    :class="IOS_BAR"
  >
    <div class="flex gap-3.5">
      <div
        v-for="i in 4"
        :key="i"
        class="size-12 rounded-xl bg-slate-200"
      />
    </div>
    <div class="overflow-hidden rounded-2xl bg-white text-[0.9375rem]">
      <div class="flex h-11 items-center border-b border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.ios.demo.copy') }}
      </div>
      <div class="relative flex h-12 items-center justify-between bg-amber-50 px-3.5 font-semibold">
        {{ t('pwaInstall.ios.addHome.btn') }}
        <PwaIcon
          name="plusSquare"
          class="size-5.5"
          :class="IOS_ICON"
        />
        <PwaTapRing inset="top-0 right-px size-12" />
      </div>
      <div class="flex h-11 items-center border-t border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.ios.demo.readingList') }}
      </div>
    </div>
  </div>

  <div
    v-else-if="kind === 'confirm'"
    class="absolute inset-0 flex flex-col px-5 pt-7 text-[0.9375rem]"
    :class="IOS_BAR"
  >
    <div class="flex h-13 items-center justify-between rounded-2xl bg-white px-3.5">
      <span class="text-slate-500">{{ t('pwaInstall.ios.demo.cancel') }}</span>
      <span class="font-semibold">{{ t('pwaInstall.ios.addHome.btn') }}</span>
      <span
        class="relative px-2 py-1.5 font-bold"
        :class="IOS_BLUE"
      >
        {{ t('pwaInstall.ios.add.btn') }}
        <PwaTapRing />
      </span>
    </div>
    <div class="mt-3 flex items-center gap-3.5 rounded-2xl bg-white p-3.5">
      <img
        :src="APP_ICON"
        alt=""
        class="size-14"
      >
      <div class="flex min-w-0 flex-col gap-1">
        <span class="font-semibold">{{ t('pwaInstall.appName') }}</span>
        <span class="truncate text-[0.8125rem] text-slate-500">{{ host }}</span>
      </div>
    </div>
    <!-- Safari 26 asks whether to open it as a web app; earlier versions have no switch. -->
    <div
      v-if="webApp"
      class="mt-3 flex h-11 items-center justify-between rounded-2xl bg-white px-3.5"
    >
      {{ t('pwaInstall.ios.demo.webApp') }}
      <span
        class="relative h-[26px] w-11 rounded-full"
        :class="IOS_GREEN"
      >
        <span class="absolute top-0.5 right-0.5 size-[22px] rounded-full bg-white" />
      </span>
    </div>
  </div>

  <div
    v-else-if="kind === 'home'"
    class="absolute inset-0 grid grid-cols-4 content-start justify-items-center gap-x-5 gap-y-[18px] bg-slate-100 px-[46px] py-10"
  >
    <div
      v-for="i in 6"
      :key="i"
      class="size-[54px] rounded-xl bg-white"
    />
    <div class="flex flex-col items-center gap-1">
      <div class="relative size-[54px]">
        <img
          :src="APP_ICON"
          alt=""
          class="size-[54px]"
        >
        <PwaTapRing round="rounded-[1.25rem]" />
      </div>
      <span class="text-[0.625rem] font-semibold">{{ t('pwaInstall.appName') }}</span>
    </div>
  </div>

  <div
    v-else-if="kind === 'chromeBar'"
    class="absolute inset-0 bg-white"
  >
    <div
      class="absolute inset-x-6 top-8 flex h-13 items-center gap-2 rounded-full pr-2 pl-4"
      :class="IOS_BAR"
    >
      <span class="min-w-0 flex-1 truncate text-[0.8125rem] text-slate-500">{{ host }}</span>
      <span class="relative grid size-9 place-items-center">
        <PwaIcon
          name="moreVertical"
          class="size-5"
          :class="IOS_ICON"
        />
        <PwaTapRing />
      </span>
    </div>
    <PwaDemoLines
      class="inset-x-10 top-26"
      short
    />
  </div>

  <div
    v-else-if="kind === 'chromeMenu'"
    class="absolute inset-0 bg-slate-100"
  >
    <div class="absolute inset-x-6 top-8 h-13 rounded-full bg-slate-200" />
    <div class="absolute top-[92px] right-[30px] w-[230px] overflow-hidden rounded-2xl bg-white text-sm">
      <div class="flex h-[42px] items-center border-b border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.android.demo.newTab') }}
      </div>
      <div class="flex h-[42px] items-center border-b border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.android.demo.bookmarks') }}
      </div>
      <div class="relative flex h-12 items-center justify-between bg-amber-50 px-3.5 font-semibold">
        {{ t('pwaInstall.android.install.btn') }}
        <PwaIcon
          name="plusSquare"
          class="size-5"
          :class="IOS_ICON"
        />
        <PwaTapRing inset="top-0 right-0 size-12" />
      </div>
    </div>
  </div>

  <div
    v-else-if="kind === 'inAppBar'"
    class="absolute inset-0 bg-white"
  >
    <div
      class="absolute inset-x-6 top-8 flex h-13 items-center gap-2.5 rounded-2xl pr-2 pl-3.5"
      :class="IOS_BAR"
    >
      <PwaIcon
        name="close"
        class="size-5"
        :class="IOS_ICON"
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-[0.8125rem] font-semibold">{{ t('pwaInstall.inApp.demo.page') }}</span>
        <span class="truncate text-[0.6875rem] text-slate-500">{{ host }}</span>
      </div>
      <span class="relative grid size-9 place-items-center">
        <PwaIcon
          name="moreVertical"
          class="size-5"
          :class="IOS_ICON"
        />
        <PwaTapRing />
      </span>
    </div>
    <PwaDemoLines
      class="inset-x-10 top-26"
      short
    />
  </div>

  <div
    v-else-if="kind === 'inAppMenu'"
    class="absolute inset-0 bg-slate-100"
  >
    <div class="absolute inset-x-6 top-8 h-13 rounded-2xl bg-slate-200" />
    <div class="absolute top-[92px] right-[30px] w-[230px] overflow-hidden rounded-2xl bg-white text-sm">
      <div class="flex h-[42px] items-center border-b border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.inApp.demo.share') }}
      </div>
      <div class="relative flex h-12 items-center justify-between bg-amber-50 px-3.5 font-semibold">
        {{ t('pwaInstall.inApp.open.btn') }}
        <PwaIcon
          name="globe"
          class="size-5"
          :class="IOS_ICON"
        />
        <PwaTapRing inset="top-0 right-0 size-12" />
      </div>
      <div class="flex h-[42px] items-center border-t border-slate-200 px-3.5 text-slate-500">
        {{ t('pwaInstall.inApp.demo.copyLink') }}
      </div>
    </div>
  </div>

  <div
    v-else-if="kind === 'opened'"
    class="absolute inset-0 bg-white"
  >
    <div class="absolute inset-x-10 top-9 flex flex-col items-center gap-3">
      <img
        :src="APP_ICON"
        alt=""
        class="size-[54px]"
      >
      <span class="text-[0.9375rem] font-semibold">{{ t('pwaInstall.inApp.demo.opened', { browser }) }}</span>
      <div class="flex w-full flex-col items-center gap-2">
        <div class="h-2.5 w-4/5 rounded-full bg-slate-200" />
        <div class="h-2.5 w-3/5 rounded-full bg-slate-200" />
      </div>
    </div>
    <div
      class="absolute inset-x-8 bottom-8 flex h-13 items-center gap-2 rounded-full px-2"
      :class="IOS_BAR"
    >
      <span class="grid size-9 place-items-center"><PwaIcon
        name="chevronLeft"
        class="size-5"
        :class="IOS_ICON"
      /></span>
      <span class="relative grid h-9 min-w-0 flex-1 place-items-center rounded-full bg-white px-3 text-[0.8125rem] text-slate-500">
        <span class="truncate">{{ host }}</span>
        <PwaTapRing round="rounded-[1.375rem]" />
      </span>
      <span class="grid size-9 place-items-center"><PwaIcon
        name="more"
        class="size-5.5"
        :class="IOS_ICON"
      /></span>
    </div>
  </div>
</template>
