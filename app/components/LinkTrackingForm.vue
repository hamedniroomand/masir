<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);

const state = reactive({
  campaignId: null as string | null,
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmTerm: '',
  utmContent: '',
});

watch(() => props.link, (link) => {
  state.campaignId = link.campaignId;
  state.utmSource = link.utmSource ?? '';
  state.utmMedium = link.utmMedium ?? '';
  state.utmCampaign = link.utmCampaign ?? '';
  state.utmTerm = link.utmTerm ?? '';
  state.utmContent = link.utmContent ?? '';
}, { immediate: true });

watch(state, () => {
  saved.value = false;
});

async function save() {
  try {
    await patch({
      campaignId: state.campaignId,
      utmSource: state.utmSource || null,
      utmMedium: state.utmMedium || null,
      utmCampaign: state.utmCampaign || null,
      utmTerm: state.utmTerm || null,
      utmContent: state.utmContent || null,
    });
    emit('updated');
  }
  catch (error: unknown) {
    showError(error);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-highlighted">
        Campaign and tracking
      </h2><p class="mt-0.5 text-xs text-muted">
        Masir adds these utm values to the destination on every click.
      </p>
    </template>
    <LinkUtmFields
      v-model:campaign-id="state.campaignId"
      v-model:utm-source="state.utmSource"
      v-model:utm-medium="state.utmMedium"
      v-model:utm-campaign="state.utmCampaign"
      v-model:utm-term="state.utmTerm"
      v-model:utm-content="state.utmContent"
      :destination-url="link.destinationUrl"
    />
    <template #footer>
      <div class="flex items-center gap-3">
        <UButton label="Save tracking" :loading="saving" @click="save" />
        <p v-if="saved" role="status" class="flex items-center gap-1.5 text-xs text-success">
          <UIcon name="i-lucide-circle-check" class="size-3.5" />Tracking saved
        </p>
      </div>
    </template>
  </UCard>
</template>
