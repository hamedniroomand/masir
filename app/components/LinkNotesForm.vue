<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { MAX_NOTES_LENGTH } from '#shared/link-input';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);

const notes = ref('');

watch(() => props.link, (link) => {
  notes.value = link.notes ?? '';
}, { immediate: true });

watch(notes, () => {
  saved.value = false;
});

async function save() {
  try {
    await patch({ notes: notes.value.trim() || null });
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
        Notes
      </h2><p class="mt-0.5 text-xs text-muted">
        Why this link exists, who asked for it, where it is printed. Only your workspace reads this.
      </p>
    </template>
    <UTextarea
      v-model="notes"
      :rows="4"
      :maxlength="MAX_NOTES_LENGTH"
      autoresize
      aria-label="Notes"
      placeholder="Printed on the spring flyer. Asked for by sales."
      class="w-full"
    />
    <div class="mt-3 flex items-center gap-3">
      <UButton label="Save notes" :loading="saving" @click="save" />
      <p v-if="saved" role="status" class="flex items-center gap-1.5 text-xs text-success">
        <UIcon name="i-lucide-circle-check" class="size-3.5" />Notes saved
      </p>
    </div>
  </UCard>
</template>
