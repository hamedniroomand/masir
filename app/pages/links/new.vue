<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

definePageMeta({ layout: 'default' });
useHead({ title: 'Create a link · Masir' });

const route = useRoute();
const { canManageLinks } = useCurrentWorkspace();

const initial = {
  destinationUrl: typeof route.query.url === 'string' ? route.query.url : '',
  title: typeof route.query.title === 'string' ? route.query.title : '',
};

function onCreated(link: LinkItem) {
  return navigateTo(`/links/${link.id}`);
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <UButton to="/" label="All links" icon="i-lucide-arrow-left" color="neutral" variant="link" size="sm" class="p-0" />
    <div>
      <h1 class="page-title">
        Create a link
      </h1><p class="page-description">
        A short address for the page you are on.
      </p>
    </div>
    <UAlert
      v-if="!canManageLinks"
      title="You can only read this workspace"
      description="Ask an owner or a member to create the link for you."
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
    />
    <div v-else class="surface p-5">
      <LinkCreateForm :initial="initial" @created="onCreated" />
    </div>
  </div>
</template>
