<script setup lang="ts">
import { buildDestination } from '#shared/utm';

const props = defineProps<{ destinationUrl?: string }>();

const campaignId = defineModel<string | null>('campaignId', { required: true });
const utmSource = defineModel<string>('utmSource', { required: true });
const utmMedium = defineModel<string>('utmMedium', { required: true });
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
      utm_medium: utmMedium.value || campaign.value?.utmMedium,
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
    <UFormField label="Campaign" name="campaignId" description="Sets utm_campaign and the default utm_medium for this link.">
      <USelect v-model="campaignId" :items="options" icon="i-lucide-megaphone" class="w-full" />
    </UFormField>
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField label="Source" name="utmSource" description="utm_source — the channel, such as newsletter or twitter.">
        <UInput v-model="utmSource" placeholder="newsletter" />
      </UFormField>
      <UFormField label="Medium" name="utmMedium" :description="campaign ? 'utm_medium — uses the campaign value until you set this field.' : 'utm_medium — optional on this link.'">
        <div class="flex items-center gap-1">
          <UInput v-model="utmMedium" :placeholder="campaign?.utmMedium ? `From campaign: ${campaign.utmMedium}` : 'email'" />
          <UButton v-if="utmMedium" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" aria-label="Clear medium" @click="utmMedium = ''" />
        </div>
      </UFormField>
      <UFormField label="Campaign" name="utmCampaign" :description="campaign ? 'utm_campaign — set by the campaign.' : 'utm_campaign — used when no campaign is set.'">
        <UInput v-if="campaign" :model-value="campaign.utmCampaign" disabled />
        <UInput v-else v-model="utmCampaign" placeholder="spring-launch" />
      </UFormField>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="Term" name="utmTerm" description="utm_term — optional. Paid keyword or term.">
        <UInput v-model="utmTerm" placeholder="running-shoes" />
      </UFormField>
      <UFormField label="Content" name="utmContent" description="utm_content — optional. Tells two placements apart.">
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
