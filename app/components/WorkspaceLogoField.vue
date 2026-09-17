<script setup lang="ts">
// The parent owns the file. The onboarding page holds it until the workspace
// exists; the settings page uploads it at once.
const props = defineProps<{ name: string; url: string | null; busy?: boolean }>();
const emit = defineEmits<{ remove: [] }>();
const file = defineModel<File | null>({ default: null });

const { open, onChange } = useFileDialog({ accept: 'image/png,image/jpeg,image/gif,image/webp', multiple: false, reset: true });
onChange((files) => {
  const picked = files?.[0];
  if (picked)
    file.value = picked;
});

const preview = useObjectUrl(file);
const src = computed(() => preview.value ?? props.url ?? undefined);
const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');

function remove() {
  file.value = null;
  emit('remove');
}
</script>

<template>
  <div class="flex items-center gap-4">
    <UAvatar :src="src" :alt="`${name} logo`" :text="initial" size="3xl" :ui="{ root: 'rounded-lg' }" />
    <div class="flex gap-2">
      <UButton :label="src ? 'Replace logo' : 'Upload logo'" color="neutral" variant="subtle" icon="i-lucide-upload" :loading="busy" @click="open()" />
      <UButton v-if="src" label="Remove" color="neutral" variant="ghost" :disabled="busy" @click="remove" />
    </div>
  </div>
</template>
