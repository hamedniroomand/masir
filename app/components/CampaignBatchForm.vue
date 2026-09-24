<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { CHANNEL_PRESETS } from '#shared/channel-presets';
import { applyUtm } from '#shared/utm';

const props = defineProps<{ campaignId?: string | null; campaignUtmCampaign?: string | null; campaignUtmMedium?: string | null }>();
const emit = defineEmits<{ created: [] }>();

const { $api } = useNuxtApp();
const showError = useErrorToast();
const { copy } = useClipboard();
const copiedKey = ref('');

async function copyRow(row: BatchRow) {
  if (!row.result?.shortUrl)
    return;
  await copy(row.result.shortUrl);
  copiedKey.value = row.key;
}

const destination = ref('');
const title = ref('');
const retrying = ref(false);

type BatchRow = {
  key: string;
  label: string;
  utmSource: string;
  utmMedium: string;
  utmContent: string;
  slug: string;
  result: { status: string; shortUrl?: string; error?: string } | null;
};

const rows = ref<BatchRow[]>(
  CHANNEL_PRESETS.map(preset => ({
    key: preset.key,
    label: preset.label,
    utmSource: preset.utmSource,
    utmMedium: preset.utmMedium,
    utmContent: '',
    slug: '',
    result: null,
  })),
);

function preview(row: BatchRow) {
  if (!destination.value)
    return '';
  try {
    return applyUtm(destination.value, {
      utm_source: row.utmSource,
      utm_medium: row.utmMedium || props.campaignUtmMedium || undefined,
      utm_campaign: props.campaignUtmCampaign || undefined,
      utm_content: row.utmContent || undefined,
    }).url;
  }
  catch {
    return '';
  }
}

function addPreset(preset: typeof CHANNEL_PRESETS[number]) {
  rows.value.push({
    key: `${preset.key}-${Date.now()}`,
    label: preset.label,
    utmSource: preset.utmSource,
    utmMedium: preset.utmMedium,
    utmContent: '',
    slug: '',
    result: null,
  });
}

function removeRow(row: BatchRow) {
  rows.value = rows.value.filter(item => item !== row);
}

async function submit() {
  const target = retrying.value ? rows.value.filter(row => row.result?.status === 'error') : rows.value;
  if (!target.length)
    return;
  if (!retrying.value) {
    for (const row of rows.value)
      row.result = null;
  }

  const items = target.map(row => ({
    clientKey: row.key,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmContent: row.utmContent,
    slug: row.slug || undefined,
  }));

  try {
    const res = await $api<{ results: { clientKey: string; status: string; link?: LinkItem; error?: string }[] }>('/api/links/batch', {
      method: 'POST',
      body: { campaignId: props.campaignId, destinationUrl: destination.value, title: title.value || undefined, items },
    });
    for (const item of res.results) {
      const row = rows.value.find(found => found.key === item.clientKey);
      if (row)
        row.result = { status: item.status, shortUrl: item.link?.shortUrl, error: item.error };
    }
    if (res.results.some(item => item.status === 'created'))
      emit('created');
  }
  catch (error) {
    const data = (error as { data?: { data?: { rows?: { clientKey: string; error: string }[] } } }).data?.data;
    if (data?.rows?.length) {
      for (const row of data.rows) {
        const found = rows.value.find(item => item.key === row.clientKey);
        if (found)
          found.result = { status: 'error', error: row.error };
      }
    }
    showError(error);
  }
  finally {
    retrying.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Destination" description="The URL all links point to." required>
      <UInput v-model="destination" placeholder="https://example.com/page" />
    </UFormField>
    <UFormField label="Title" description="Optional. Shared across every created link.">
      <UInput v-model="title" placeholder="Spring newsletter" />
    </UFormField>

    <div v-for="row in rows" :key="row.key" class="space-y-2 rounded-lg border border-default bg-muted/20 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium">
          {{ row.label }}
        </p>
        <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" @click="removeRow(row)" />
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <UFormField label="Source" description="utm_source">
          <UInput v-model="row.utmSource" placeholder="newsletter" />
        </UFormField>
        <UFormField label="Medium" description="utm_medium">
          <UInput v-model="row.utmMedium" placeholder="email" />
        </UFormField>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <UFormField label="Campaign" description="utm_campaign">
          <UInput :model-value="campaignUtmCampaign ?? ''" disabled />
        </UFormField>
        <UFormField label="Content" description="utm_content">
          <UInput v-model="row.utmContent" placeholder="header-button" />
        </UFormField>
      </div>
      <UFormField label="Short address" description="Leave blank to generate a unique slug.">
        <UInput v-model="row.slug" placeholder="auto-generated" />
      </UFormField>
      <p v-if="preview(row)" class="text-xs text-muted break-all">
        Visitors land on {{ preview(row) }}
      </p>
      <div v-if="row.result" class="flex items-center gap-2 text-xs">
        <span v-if="row.result.status === 'created'" class="text-success">Created {{ row.result.shortUrl }}</span>
        <span v-else class="text-error">{{ row.result.error }}</span>
        <UButton v-if="row.result?.status === 'created'" size="xs" variant="ghost" :label="copiedKey === row.key ? 'Copied' : 'Copy'" @click="copyRow(row)" />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton label="Create links" @click="submit" />
      <UDropdownMenu :items="CHANNEL_PRESETS.map(p => ({ label: p.label, onSelect: () => addPreset(p) }))">
        <UButton label="Add preset" color="neutral" variant="outline" trailing-icon="i-lucide-plus" />
      </UDropdownMenu>
      <UButton v-if="rows.some(r => r.result?.status === 'error')" label="Retry failed" color="neutral" variant="outline" @click="retrying = true; submit()" />
    </div>
  </div>
</template>
