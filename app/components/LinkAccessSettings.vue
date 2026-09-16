<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const saving = ref(false);

const state = reactive({
  startsAt: null as number | null,
  expiresAt: null as number | null,
  maximumVisits: null as number | null,
  expirationDestination: '',
});

watch(() => props.link, (link) => {
  state.startsAt = link.startsAt ? Date.parse(link.startsAt) : null;
  state.expiresAt = link.expiresAt ? Date.parse(link.expiresAt) : null;
  state.maximumVisits = link.maximumVisits;
  state.expirationDestination = link.expirationDestination ?? '';
}, { immediate: true });

async function save() {
  saving.value = true;
  try {
    await $fetch(`/api/links/${props.link.id}`, {
      method: 'PATCH',
      body: {
        startsAt: state.startsAt,
        expiresAt: state.expiresAt,
        maximumVisits: state.maximumVisits,
        expirationDestination: state.expirationDestination.trim() || null,
      },
    });
    emit('updated');
  }
  catch (e) {
    showError(e);
  }
  finally {
    saving.value = false;
  }
}

function setOneTime() {
  state.maximumVisits = 1;
}
</script>

<template>
  <div class="space-y-5">
    <LinkScheduleFields v-model:starts-at="state.startsAt" v-model:expires-at="state.expiresAt" />
    <UFormField label="Maximum visits" description="Optional. The link stops after this many successful redirects.">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput v-model.number="state.maximumVisits" type="number" min="1" placeholder="No limit" class="sm:max-w-40" />
        <UButton type="button" label="One-time link" color="neutral" variant="outline" size="sm" @click="setOneTime" />
      </div>
    </UFormField>
    <UFormField label="Expiration destination" description="Optional. Send visitors here when the link expires.">
      <UInput v-model="state.expirationDestination" type="url" inputmode="url" placeholder="https://example.com/expired" />
    </UFormField>
    <UButton label="Save access settings" :loading="saving" @click="save" />
  </div>
</template>
