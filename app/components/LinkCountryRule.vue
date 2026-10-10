<script setup lang="ts">
type CountryRule = { code: string; url: string };

defineProps<{ position: number }>();
defineEmits<{ remove: [] }>();

const rule = defineModel<CountryRule>({ required: true });
</script>

<template>
  <div class="mb-2 flex items-start gap-2">
    <UInput
      v-model="rule.code"
      :aria-label="`Country code ${position}`"
      placeholder="DE"
      maxlength="2"
      class="w-20"
    />
    <UInput
      v-model="rule.url"
      type="url"
      inputmode="url"
      :aria-label="`Country destination ${position}`"
      placeholder="https://example.com/de"
      class="flex-1"
    />
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      :aria-label="`Remove country rule ${position}`"
      @click="$emit('remove')"
    />
  </div>
</template>
