<template>
  <div class="container mx-auto max-w-screen-2xl px-4 py-8">
    <div class="mb-8 space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        อัลกุรอานแปลไทย
      </h1>
      <p class="text-lg text-slate-600">ศึกษาอัลกุรอานพร้อมคำแปลภาษาไทย</p>
    </div>

    <div class="mb-8 flex justify-center space-x-2">
      <button
        :class="activeTab === 'surah'
          ? 'bg-stone-900 text-white shadow hover:bg-stone-900/90'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
        class="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
        @click="activeTab = 'surah'"
      >
        ซูเราะห์
      </button>
      <button
        :class="activeTab === 'juz'
          ? 'bg-stone-900 text-white shadow hover:bg-stone-900/90'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
        class="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
        @click="activeTab = 'juz'"
      >
        ญุซ
      </button>
    </div>

    <ReadingSurahList v-if="activeTab === 'surah'" />
    <ReadingJuzList v-else />
  </div>
</template>

<script setup lang="ts">
const activeTab = ref<'surah' | 'juz'>('surah')

useSeoMeta({
  title: 'อัลกุรอาน - อัลกุรอานพร้อมคำแปลภาษาไทย',
  ogTitle: 'อัลกุรอานแปลไทย',
  description: 'ศึกษาความหมายอัลกุรอานภาษาไทย ด้วยแหล่งคำแปลที่หลากหลาย',
  ogDescription: 'ศึกษาความหมายอัลกุรอานภาษาไทย ด้วยแหล่งคำแปลที่หลากหลาย',
})
</script>
