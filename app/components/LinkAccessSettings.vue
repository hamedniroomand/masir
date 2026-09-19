<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { toVisitLimit } from '#shared/link-input';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { saving, patch } = useLinkPatch(() => props.link.id);

const state = reactive({
  startsAt: null as number | null,
  expiresAt: null as number | null,
  maximumVisits: null as number | null,
  expirationDestination: '',
  limitDestination: '',
  scheduledDestination: '',
  tags: [] as string[],
});

watch(() => props.link, (link) => {
  state.startsAt = link.startsAt ? Date.parse(link.startsAt) : null;
  state.expiresAt = link.expiresAt ? Date.parse(link.expiresAt) : null;
  state.maximumVisits = link.maximumVisits;
  state.expirationDestination = link.expirationDestination ?? '';
  state.limitDestination = link.limitDestination ?? '';
  state.scheduledDestination = link.scheduledDestination ?? '';
  state.tags = [...link.tags];
}, { immediate: true });

async function save() {
  try {
    await patch({
      startsAt: state.startsAt,
      expiresAt: state.expiresAt,
      maximumVisits: toVisitLimit(state.maximumVisits),
      expirationDestination: state.expirationDestination.trim() || null,
      limitDestination: state.limitDestination.trim() || null,
      scheduledDestination: state.scheduledDestination.trim() || null,
      tags: state.tags,
    });
    emit('updated');
  }
  catch (error) {
    showError(error);
  }
}
</script>

<template>
  <div class="space-y-5">
    <LinkPasswordControl :link="link" @updated="emit('updated')" />
    <div class="border-t border-default pt-5">
      <LinkScheduleFields v-model:starts-at="state.startsAt" v-model:expires-at="state.expiresAt" />
      <UFormField v-if="state.startsAt" label="Before the start time" description="Optional. Send visitors here until the link opens." class="mt-3">
        <UInput v-model="state.scheduledDestination" type="url" inputmode="url" placeholder="https://example.com/coming-soon" />
      </UFormField>
    </div>
    <UFormField label="Tags">
      <LinkTagInput v-model="state.tags" />
    </UFormField>
    <UFormField label="Maximum visits" description="Optional. The link stops after this many successful redirects.">
      <LinkVisitLimitField v-model="state.maximumVisits" />
    </UFormField>
    <UFormField v-if="state.maximumVisits" label="After the visit cap" description="Optional. Send visitors here when the cap is used up.">
      <UInput v-model="state.limitDestination" type="url" inputmode="url" placeholder="https://example.com/sold-out" />
    </UFormField>
    <UFormField label="Expiration destination" description="Optional. Send visitors here when the link expires.">
      <UInput v-model="state.expirationDestination" type="url" inputmode="url" placeholder="https://example.com/expired" />
    </UFormField>
    <UButton label="Save access settings" :loading="saving" @click="save" />
  </div>
</template>
