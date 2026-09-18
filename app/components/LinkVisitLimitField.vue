<script setup lang="ts">
import { toVisitLimit } from '#shared/link-input';

const model = defineModel<number | null>({ required: true });

const hasLimit = computed(() => toVisitLimit(model.value) != null);
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
    <UInput v-model.number="model" type="number" min="1" placeholder="No limit" class="sm:max-w-40" />
    <UButton type="button" label="One-time link" color="neutral" variant="outline" size="sm" @click="model = 1" />
    <UButton v-if="hasLimit" type="button" label="Remove limit" icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="model = null" />
  </div>
</template>
