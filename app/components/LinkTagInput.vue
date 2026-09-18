<script setup lang="ts">
const model = defineModel<string[]>({ default: () => [] });

const { data } = useApi<{ items: { name: string }[] }>(() => '/api/tags');

const items = computed(() => data.value?.items.map(tag => tag.name) ?? []);

// UInputMenu clears the search term only when it selects an item itself. A
// created item is set by us, so we clear the term too.
const searchTerm = ref('');

function onCreate(item: string) {
  searchTerm.value = '';
  const name = item.trim();
  if (!name || model.value.includes(name))
    return;
  model.value = [...model.value, name];
}
</script>

<template>
  <UInputMenu
    v-model="model"
    v-model:search-term="searchTerm"
    multiple
    create-item
    :items="items"
    placeholder="Add tags"
    aria-label="Tags"
    @create="onCreate"
  />
</template>
