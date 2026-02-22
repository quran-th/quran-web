<template>
  <div class="container mx-auto max-w-screen-2xl px-4 py-8">
    <div class="mb-8 space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        อัลกุรอานแปลไทย
      </h1>
      <p class="text-lg text-slate-600">ศึกษาอัลกุรอานพร้อมคำแปลภาษาไทย</p>
    </div>

    <!-- Quick Links / Tabs Placeholder -->
    <div class="mb-8 flex justify-center space-x-2">
      <button
        class="inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow transition-colors hover:bg-stone-900/90"
      >
        ซูเราะห์
      </button>
      <button
        class="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        ญุซ
      </button>
    </div>

    <ReadingSurahList />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'อัลกุรอานแปลไทย - คำแปลและความหมายระดับคำ',
  meta: [
    { name: 'description', content: 'อ่านอัลกุรอานภาษาไทยพร้อมคำแปลและความหมายระดับคำ รองรับทั้งการอ่านแบบซูเราะห์และมุษอฟ' },
  ],
})
</script>
