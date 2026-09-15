<script setup lang="ts">
import { buildDestination } from '#shared/utm';

const props = defineProps<{ destinationUrl?: string }>();

const campaignId = defineModel<string | null>('campaignId', { required: true });
const utmSource = defineModel<string>('utmSource', { required: true });
const utmContent = defineModel<string>('utmContent', { required: true });

const { options, byId } = useCampaignOptions();

const campaign = computed(() => campaignId.value ? byId.value.get(campaignId.value) : undefined);

const preview = computed(() => {
  if (!props.destinationUrl)
    return '';
  try {
    return buildDestination(props.destinationUrl, {
      utm_source: utmSource.value,
      utm_medium: campaign.value?.utmMedium,
      utm_campaign: campaign.value?.utmCampaign,
      utm_content: utmContent.value,
    });
  }
  catch {
    return '';
  }
});
</script>

<template>
  <div class="space-y-3">
    <UFormField label="Campaign" name="campaignId" description="Sets utm_campaign and utm_medium for this link.">
      <USelect v-model="campaignId" :items="options" icon="i-lucide-megaphone" class="w-full" />
    </UFormField>
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="utm_source" name="utmSource" description="The channel, such as newsletter or twitter.">
        <UInput v-model="utmSource" placeholder="newsletter" />
      </UFormField>
      <UFormField label="utm_content" name="utmContent" description="Optional. Tells two placements apart.">
        <UInput v-model="utmContent" placeholder="header-button" />
      </UFormField>
    </div>
    <div v-if="campaign" class="flex flex-wrap gap-1.5">
      <UBadge :label="`utm_campaign=${campaign.utmCampaign}`" color="neutral" variant="subtle" size="sm" />
      <UBadge v-if="campaign.utmMedium" :label="`utm_medium=${campaign.utmMedium}`" color="neutral" variant="subtle" size="sm" />
    </div>
    <p v-if="preview" class="break-all rounded-lg bg-muted/60 p-3 text-xs text-muted">
      Visitors land on: {{ preview }}
    </p>
  </div>
</template>
