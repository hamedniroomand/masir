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

const { current } = useCurrentWorkspace();

// The style is a browsing preference, not workspace data, so it stays in this
// browser. The workspace id keys it, because one person may hold several.
const storageKey = computed(() => `masir:qr-style:${current.value?.id ?? 'default'}`);
const style = ref({ fg: '000000', bg: 'ffffff', logo: false });

const HEX = /^[0-9a-f]{6}$/;

// The store is only a memory of this panel's own controls, but a value from
// an older build or a hand edit would make every request answer 422.
function readStyle() {
  try {
    const raw = localStorage.getItem(storageKey.value);
    if (!raw)
      return;
    const saved = JSON.parse(raw) as Partial<typeof style.value>;
    style.value = {
      fg: typeof saved.fg === 'string' && HEX.test(saved.fg) ? saved.fg : '000000',
      bg: typeof saved.bg === 'string' && HEX.test(saved.bg) ? saved.bg : 'ffffff',
      logo: saved.logo === true,
    };
  }
  catch {
    // A blocked or full store only costs the remembered choice.
  }
}

onMounted(readStyle);
watch(storageKey, readStyle);

watch(style, (value) => {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(value));
  }
  catch {
    // Same here. The preview still follows the controls.
  }
}, { deep: true });

const hasLogo = computed(() => Boolean(current.value?.logoUrl));

const styleQuery = computed(() => {
  const params = new URLSearchParams();
  if (style.value.fg !== '000000')
    params.set('fg', style.value.fg);
  if (style.value.bg !== 'ffffff')
    params.set('bg', style.value.bg);
  if (style.value.logo && hasLogo.value)
    params.set('logo', '1');
  const text = params.toString();
  return text ? `&${text}` : '';
});

const qrPngPreviewUrl = computed(
  () => `/api/links/${props.linkId}/qr?format=png&size=${props.previewSize}${styleQuery.value}`,
);
const qrSvgPreviewUrl = computed(
  () => `/api/links/${props.linkId}/qr?format=svg&size=${props.previewSize}${styleQuery.value}`,
);
const qrPngDownloadUrl = computed(() => `/api/links/${props.linkId}/qr?format=png${styleQuery.value}`);
const qrSvgDownloadUrl = computed(() => `/api/links/${props.linkId}/qr?format=svg${styleQuery.value}`);

// Only the svg carries the logo, so the preview follows the toggle.
const previewUrl = computed(() => (style.value.logo && hasLogo.value ? qrSvgPreviewUrl.value : qrPngPreviewUrl.value));

function onColour(field: 'fg' | 'bg', value: string) {
  style.value[field] = value.replace(/^#/, '').toLowerCase();
}

const { copy, copied, isSupported } = useClipboardItems();
const copying = ref(false);
const copyError = ref(false);

async function copyQrImage() {
  copying.value = true;
  copyError.value = false;
  try {
    const res = await fetch(qrPngPreviewUrl.value);
    if (!res.ok)
      throw new Error('fetch failed');
    const blob = await res.blob();
    await copy([new ClipboardItem({ 'image/png': blob })]);
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
    <p v-if="showShortUrl && shortUrl" class="break-all text-center text-xs text-muted">
      {{ shortUrl }}
    </p>
    <div class="flex flex-wrap items-end justify-center gap-3">
      <UFormField label="Foreground">
        <input
          :value="`#${style.fg}`"
          type="color"
          aria-label="QR foreground colour"
          class="h-9 w-14 cursor-pointer rounded-md border border-default bg-default"
          @input="onColour('fg', ($event.target as HTMLInputElement).value)"
        >
      </UFormField>
      <UFormField label="Background">
        <input
          :value="`#${style.bg}`"
          type="color"
          aria-label="QR background colour"
          class="h-9 w-14 cursor-pointer rounded-md border border-default bg-default"
          @input="onColour('bg', ($event.target as HTMLInputElement).value)"
        >
      </UFormField>
      <USwitch v-if="hasLogo" v-model="style.logo" label="Workspace logo" class="pb-2" />
    </div>
    <p v-if="style.logo && hasLogo" class="text-center text-xs text-muted">
      The logo needs the SVG. The PNG download carries the colours only.
    </p>
    <div class="relative isolate overflow-hidden rounded-panel border border-default bg-muted/40 px-5 py-8">
      <BrandPattern />
      <div class="mx-auto w-fit rounded-panel border border-default bg-white p-4 shadow-control">
        <img
          :src="previewUrl"
          alt="QR code for short link"
          :width="previewSize"
          :height="previewSize"
        >
      </div>
    </div>
    <UAlert
      v-if="copyError || !isSupported"
      title="Could not copy image"
      description="Your browser may block image copy. Download PNG instead."
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
    />
    <div class="flex flex-wrap justify-center gap-2">
      <UButton
        v-if="isSupported"
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
