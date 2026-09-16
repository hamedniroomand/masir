<script setup lang="ts">
const model = defineModel<string[]>({ default: () => [] });

const { data } = useFetch<{ items: { name: string }[] }>(() => '/api/tags');

const items = computed(() => data.value?.items.map(t => t.name) ?? []);

function onCreate(item: string) {
  const name = item.trim();
  if (!name || model.value.includes(name))
    return;
  model.value = [...model.value, name];
}
</script>

<template>
  <UInputMenu
    v-model="model"
    multiple
    create-item
    :items="items"
    placeholder="Add tags"
    aria-label="Tags"
    @create="onCreate"
  />
</template>
