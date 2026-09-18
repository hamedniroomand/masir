<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { CampaignItem } from '~/composables/useCampaigns';
import * as v from 'valibot';

const props = defineProps<{ campaign?: CampaignItem }>();

const emit = defineEmits<{ saved: [campaign: CampaignItem] }>();

const { $api } = useNuxtApp();

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a campaign name.')),
  utmCampaign: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a utm_campaign value.')),
  utmMedium: v.optional(v.pipe(v.string(), v.trim())),
});

type Schema = v.InferOutput<typeof schema>;

const state = reactive({
  name: props.campaign?.name ?? '',
  utmCampaign: props.campaign?.utmCampaign ?? '',
  utmMedium: props.campaign?.utmMedium ?? '',
});

const form = useTemplateRef('form');
useFormRevalidation(form, state);
const loading = ref(false);
const showError = useErrorToast();

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  loading.value = true;
  form.value?.clear();
  try {
    const saved = await $api<CampaignItem>(
      props.campaign ? `/api/campaigns/${props.campaign.id}` : '/api/campaigns',
      {
        method: props.campaign ? 'PATCH' : 'POST',
        body: { name: state.name, utmCampaign: state.utmCampaign, utmMedium: state.utmMedium || null },
      },
    );
    emit('saved', saved);
  }
  catch (error: unknown) {
    const err = error as { statusCode?: number };
    if (err.statusCode === 409)
      form.value?.setErrors([{ name: 'utmCampaign', message: errorReason(error, 'Invalid value.') }]);
    else
      showError(error);
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="schema"
    :state="state"
    :validate-on="[]"
    class="space-y-5"
    @submit="onSubmit"
  >
    <UAlert
      v-if="campaign"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :description="`These values apply to every link in this campaign (${campaign.linkCount}). Each link keeps its own utm_source.`"
    />
    <UFormField label="Campaign name" name="name" required description="The name your team uses.">
      <UInput v-model="state.name" placeholder="Spring launch" />
    </UFormField>
    <UFormField label="utm_campaign" name="utmCampaign" required description="Every link in this campaign sends this value.">
      <UInput v-model="state.utmCampaign" placeholder="spring-launch" />
    </UFormField>
    <UFormField label="utm_medium" name="utmMedium" description="Optional. The shared channel type, such as email or social.">
      <UInput v-model="state.utmMedium" placeholder="email" />
    </UFormField>
    <UButton type="submit" :label="campaign ? 'Save campaign' : 'Create campaign'" block :loading="loading" />
  </UForm>
</template>
