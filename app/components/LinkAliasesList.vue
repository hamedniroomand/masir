<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { MAX_ALIASES_PER_LINK } from '#shared/link-input';
import { normalizeSlug } from '#shared/slug';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const { $api } = useNuxtApp();
const showError = useErrorToast();

const newAlias = ref('');
const busy = ref(false);
const error = ref('');

const full = computed(() => props.link.aliases.length >= MAX_ALIASES_PER_LINK);

async function run(action: () => Promise<unknown>) {
  error.value = '';
  busy.value = true;
  try {
    await action();
    emit('updated');
  }
  catch (failure: unknown) {
    const detail = failure as { statusCode?: number };
    if (detail.statusCode === 409 || detail.statusCode === 422)
      error.value = errorReason(failure, 'We could not add this address.');
    else
      showError(failure);
  }
  finally {
    busy.value = false;
  }
}

function add() {
  const slug = normalizeSlug(newAlias.value);
  if (!slug)
    return;
  return run(async () => {
    await $api(`/api/links/${props.link.id}/aliases`, { method: 'POST', body: { slug } });
    newAlias.value = '';
  });
}

function remove(slug: string) {
  return run(() => $api(`/api/links/${props.link.id}/aliases/${slug}`, { method: 'DELETE' }));
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-highlighted">
        Extra addresses
      </h2><p class="mt-0.5 text-xs text-muted">
        Each one reaches the same destination. A removed address stays reserved, so nobody else can take it.
      </p>
    </template>

    <p v-if="error" role="alert" class="mb-3 text-sm text-error">
      {{ error }}
    </p>

    <div v-if="link.aliases.length" class="mb-4 flex flex-wrap gap-1.5">
      <UBadge
        v-for="alias in link.aliases"
        :key="alias"
        color="neutral"
        variant="subtle"
        size="lg"
      >
        /{{ alias }}
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          class="-me-1 ms-1"
          :aria-label="`Remove the address ${alias}`"
          :disabled="busy"
          @click="remove(alias)"
        />
      </UBadge>
    </div>

    <div class="flex gap-2">
      <UInput
        v-model="newAlias"
        aria-label="New address"
        placeholder="spring-sale"
        icon="i-lucide-link"
        class="flex-1"
        :disabled="full"
        @keydown.enter.prevent="add"
      />
      <UButton label="Add" :loading="busy" :disabled="full || !newAlias.trim()" @click="add" />
    </div>
    <p v-if="full" class="mt-2 text-xs text-muted">
      A link holds at most {{ MAX_ALIASES_PER_LINK }} extra addresses.
    </p>
  </UCard>
</template>
