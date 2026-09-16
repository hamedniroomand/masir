<script setup lang="ts">
import { buildDestination } from '#shared/utm';

const props = defineProps<{ destinationUrl?: string }>();

const campaignId = defineModel<string | null>('campaignId', { required: true });
const utmSource = defineModel<string>('utmSource', { required: true });
const utmCampaign = defineModel<string>('utmCampaign', { required: true });
const utmTerm = defineModel<string>('utmTerm', { required: true });
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
      utm_campaign: campaign.value?.utmCampaign ?? utmCampaign.value,
      utm_term: utmTerm.value,
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
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField label="utm_source" name="utmSource" description="The channel, such as newsletter or twitter.">
        <UInput v-model="utmSource" placeholder="newsletter" />
      </UFormField>
      <UFormField label="utm_medium" name="utmMedium" :description="campaign ? 'Set by the campaign.' : 'Choose a campaign to set this value.'">
        <UInput :model-value="campaign?.utmMedium ?? ''" disabled placeholder="Set by campaign" />
      </UFormField>
      <UFormField label="utm_campaign" name="utmCampaign" :description="campaign ? 'Set by the campaign.' : 'Used when no campaign is set.'">
        <UInput v-if="campaign" :model-value="campaign.utmCampaign" disabled />
        <UInput v-else v-model="utmCampaign" placeholder="spring-launch" />
      </UFormField>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="utm_term" name="utmTerm" description="Optional. Paid keyword or term.">
        <UInput v-model="utmTerm" placeholder="running-shoes" />
      </UFormField>
      <UFormField label="utm_content" name="utmContent" description="Optional. Tells two placements apart.">
        <UInput v-model="utmContent" placeholder="header-button" />
      </UFormField>
    </div>
    <div v-if="preview" class="flex items-start gap-2.5 rounded-lg border border-default bg-muted/40 px-4 py-3 text-xs">
      <UIcon name="i-lucide-corner-down-right" class="mt-0.5 size-3.5 shrink-0 text-muted" />
      <span class="shrink-0 text-muted">Visitors land on</span>
      <span class="break-all text-toned">{{ preview }}</span>
    </div>
  </div>
</template>
