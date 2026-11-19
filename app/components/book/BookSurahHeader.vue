<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  surahNumber: number;
  nameArabic: string;
  nameThai: string;
  revelationPlace: string;
  versesCount: number;
}>();

// Surah 9 has no bismillah; in surah 1 it is verse 1 itself
const showBismillah = computed(() => props.surahNumber !== 1 && props.surahNumber !== 9);
const arabicTitle = computed(() => (props.nameArabic.startsWith("سورة") ? props.nameArabic : `سورة ${props.nameArabic}`));
const thaiTitle = computed(() => (props.nameThai.startsWith("ซูเราะ") ? props.nameThai : `ซูเราะฮ์${props.nameThai}`));
const place = computed(() => (props.revelationPlace === "makkiyah" ? "มักกียะฮ์" : "มะดะนียะฮ์"));
</script>

<template>
  <div class="pb-1">
    <div class="flex flex-col items-center rounded-[4px] bg-paper-wash px-4 pb-3 pt-3.5">
      <span dir="rtl" lang="ar" class="font-arabic text-[length:calc(34px*var(--book-scale,1))] leading-[1.5] text-sage-700">{{ arabicTitle }}</span>
      <span class="text-[length:calc(17px*var(--book-scale,1))] font-semibold text-ink">{{ thaiTitle }}</span>
      <span class="mt-0.5 text-[length:calc(12px*var(--book-scale,1))] text-ink-muted">ซูเราะฮ์ที่ {{ surahNumber }} · {{ place }} · {{ versesCount }} อายะห์</span>
    </div>
    <div v-if="showBismillah" class="flex flex-col items-center pb-2 pt-2.5">
      <div dir="rtl" lang="ar" class="font-arabic text-[length:calc(26px*var(--book-scale,1))] leading-[1.9] text-ink-strong">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
      <p class="m-0 text-center font-reading text-[length:calc(13.5px*var(--book-scale,1))] leading-[1.6] text-ink-icon">ด้วยพระนามของอัลลอฮ์ ผู้ทรงกรุณาปรานี ผู้ทรงเมตตาเสมอ</p>
    </div>
  </div>
</template>
