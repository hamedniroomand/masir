<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

type Member = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);
const { data: members } = await useApi<{ items: Member[] }>('/api/workspaces/members/options');

const responsibleUserId = ref<string | null>(null);
const reviewAt = ref<number | null>(null);

watch(() => props.link, (link) => {
  responsibleUserId.value = link.responsibleUserId;
  reviewAt.value = link.reviewAt ? Date.parse(link.reviewAt) : null;
}, { immediate: true });

watch([responsibleUserId, reviewAt], () => {
  saved.value = false;
});

const memberOptions = computed(() => {
  const items = (members.value?.items ?? [])
    .map((member) => {
      const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
      return {
        label: name ? `${name} (${member.email})` : member.email,
        value: member.userId,
      };
    });
  return [{ label: 'Nobody', value: null }, ...items];
});

async function save() {
  try {
    await patch({
      responsibleUserId: responsibleUserId.value,
      reviewAt: reviewAt.value,
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
        Responsibility
      </h2>
      <p class="mt-0.5 text-xs text-muted">
        Who follows up on this link, and when to check it again.
      </p>
    </template>
    <div class="space-y-4">
      <UFormField label="Responsible member">
        <USelect
          v-model="responsibleUserId"
          :items="memberOptions"
          aria-label="Responsible member"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Review date">
        <LinkExpiryPicker v-model="reviewAt" empty-label="No review date" allow-past />
      </UFormField>
      <div class="flex items-center gap-3">
        <UButton label="Save responsibility" :loading="saving" @click="save" />
        <p v-if="saved" role="status" class="flex items-center gap-1.5 text-xs text-success">
          <UIcon name="i-lucide-circle-check" class="size-3.5" />Responsibility saved
        </p>
      </div>
    </div>
  </UCard>
</template>
