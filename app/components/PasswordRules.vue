<script setup lang="ts">
import { ACCOUNT_PASSWORD_RULES } from '#shared/account-password';

const props = defineProps<{ value: string }>();

const rules = computed(() => ACCOUNT_PASSWORD_RULES.map(rule => ({
  label: rule.label,
  met: rule.test.test(props.value),
})));

// The list below states the same thing for a screen reader, so the bar is
// decorative and carries no label.
const metCount = computed(() => rules.value.filter(rule => rule.met).length);
</script>

<template>
  <div class="mt-2 space-y-2">
    <UProgress
      :model-value="metCount"
      :max="rules.length"
      :color="metCount === rules.length ? 'success' : 'primary'"
      size="xs"
      aria-hidden="true"
    />
    <ul class="space-y-1">
      <li
        v-for="rule in rules"
        :key="rule.label"
        class="flex items-center gap-1.5 text-xs"
        :class="rule.met ? 'text-success' : 'text-muted'"
      >
        <UIcon :name="rule.met ? 'i-lucide-circle-check' : 'i-lucide-circle'" class="size-3.5 shrink-0" />
        {{ rule.label }}
        <span class="sr-only">{{ rule.met ? 'Rule met' : 'Rule not met' }}</span>
      </li>
    </ul>
  </div>
</template>
