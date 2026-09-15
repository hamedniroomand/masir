<script setup lang="ts">
definePageMeta({ layout: 'default' });

const { user } = useUserSession();
if (user.value?.role !== 'admin')
  throw createError({ statusCode: 403 });

const type = ref('');
const { data } = await useFetch('/api/admin/security-events', {
  query: computed(() => ({ type: type.value || undefined })),
  watch: [type],
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">
      Security log
    </h1>
    <UInput v-model="type" placeholder="Filter by type" />
    <UTable
      v-if="data?.items"
      :data="data.items"
      :columns="[
        { accessorKey: 'type', header: 'Type' },
        { accessorKey: 'createdAt', header: 'Time' },
        { accessorKey: 'actorUserId', header: 'Actor' },
      ]"
    />
  </div>
</template>
