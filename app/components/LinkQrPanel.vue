<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    linkId: string;
    shortUrl?: string;
    previewSize?: number;
    showShortUrl?: boolean;
  }>(),
  {
    previewSize: 200,
    showShortUrl: false,
  },
);

const qrPngPreviewUrl = computed(
  () => `/api/links/${props.linkId}/qr?format=png&size=${props.previewSize}`,
);
const qrPngDownloadUrl = computed(() => `/api/links/${props.linkId}/qr?format=png`);
const qrSvgDownloadUrl = computed(() => `/api/links/${props.linkId}/qr?format=svg`);

const copying = ref(false);
const copied = ref(false);
const copyError = ref(false);

async function copyQrImage() {
  copying.value = true;
  copied.value = false;
  copyError.value = false;
  try {
    const res = await fetch(qrPngPreviewUrl.value);
    if (!res.ok)
      throw new Error('fetch failed');
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    copied.value = true;
  }
  catch {
    copyError.value = true;
  }
  finally {
    copying.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="showShortUrl && shortUrl" class="text-sm text-muted">
      {{ shortUrl }}
    </p>
    <div class="mx-auto w-fit rounded-xl border border-default bg-white p-3">
      <img
        :src="qrPngPreviewUrl"
        alt="QR code for short link"
        :width="previewSize"
        :height="previewSize"
      >
    </div>
    <UAlert
      v-if="copyError"
      title="Could not copy image"
      description="Your browser may block image copy. Download PNG instead."
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
    />
    <div class="flex flex-wrap justify-center gap-2">
      <UButton
        size="sm"
        :label="copied ? 'Copied' : 'Copy image'"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        color="neutral"
        variant="outline"
        :loading="copying"
        @click="copyQrImage"
      />
      <UButton
        size="sm"
        label="PNG"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        :href="qrPngDownloadUrl"
        external
        download
      />
      <UButton
        size="sm"
        label="SVG"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        :href="qrSvgDownloadUrl"
        external
        download
      />
    </div>
  </div>
</template>
