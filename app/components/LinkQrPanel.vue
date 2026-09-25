<script setup lang="ts">
import { qrStyleWarning } from '#shared/qr-style';
import { svgToPngBlob } from '~/utils/qr-raster';

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

const qrQuery = computed(() => {
  const params = new URLSearchParams();
  params.set('size', String(props.previewSize));
  if (style.value.fg !== '000000')
    params.set('fg', style.value.fg);
  if (style.value.bg !== 'ffffff')
    params.set('bg', style.value.bg);
  if (style.value.logo && hasLogo.value)
    params.set('logo', '1');
  return params.toString();
});

const previewUrl = computed(() => `/api/links/${props.linkId}/qr?format=svg&${qrQuery.value}`);
const qrSvgDownloadUrl = previewUrl;
const serverPngDownloadUrl = computed(() => `/api/links/${props.linkId}/qr?format=png&${qrQuery.value}`);

const warningMessage = computed(() => qrStyleWarning(style.value.fg, style.value.bg));

function onColour(field: 'fg' | 'bg', value: string) {
  style.value[field] = value.replace(/^#/, '').toLowerCase();
}

const toast = useToast();
const { copy, copied, isSupported } = useClipboardItems();
const copying = ref(false);
const downloadingPng = ref(false);
const rasterFailed = ref(false);

function offerPngDownloadToast() {
  toast.add({
    title: 'Could not copy image',
    description: 'Your browser may block image copy. Download PNG instead.',
    color: 'warning',
    icon: 'i-lucide-triangle-alert',
    actions: [
      {
        label: 'Download PNG',
        onClick: () => {
          void downloadPng();
        },
      },
    ],
  });
}

async function downloadPng() {
  downloadingPng.value = true;
  rasterFailed.value = false;
  try {
    const blob = await svgToPngBlob(previewUrl.value, 1000);
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `masir-${props.linkId}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }
  catch {
    rasterFailed.value = true;
  }
  finally {
    downloadingPng.value = false;
  }
}

async function copyQrImage() {
  if (!isSupported.value) {
    offerPngDownloadToast();
    return;
  }
  copying.value = true;
  rasterFailed.value = false;
  try {
    const blob = await svgToPngBlob(previewUrl.value, 1000);
    await copy([new ClipboardItem({ 'image/png': blob })]);
  }
  catch (error) {
    if (error instanceof Error && (error.message.includes('Rasterization') || error.message.includes('Canvas') || error.message.includes('Image load'))) {
      rasterFailed.value = true;
    }
    else {
      offerPngDownloadToast();
    }
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
      v-if="rasterFailed"
      title="This browser cannot draw the logo into a PNG. The PNG below has no logo."
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :actions="[
        {
          label: 'Download server PNG',
          href: serverPngDownloadUrl,
          external: true,
          download: true,
        },
      ]"
    />
    <UAlert
      v-if="warningMessage"
      :description="warningMessage"
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
        :loading="downloadingPng"
        @click="downloadPng"
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
