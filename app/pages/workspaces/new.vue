<script setup lang="ts">
import * as v from 'valibot';
import { normalizeWorkspaceSlug, workspaceSlugSchema } from '#shared/workspace-slug';

definePageMeta({ layout: 'auth' });

const config = useRuntimeConfig();
const rootHost = computed(() => new URL(config.public.shortDomain).host);

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a workspace name.')),
  slug: workspaceSlugSchema,
});

const state = reactive({ name: '', slug: '' });
const error = ref('');
const loading = ref(false);
const slugTouched = ref(false);

// The address is suggested from the name until the user edits it. It is
// immutable after creation, so they must see it before they submit.
watch(() => state.name, (name) => {
  if (!slugTouched.value)
    state.slug = normalizeWorkspaceSlug(name);
});

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const workspace = await $fetch<{ slug: string }>('/api/workspaces', {
      method: 'POST',
      body: { name: state.name, slug: state.slug },
    });
    await navigateTo(`/workspaces/invite?slug=${encodeURIComponent(workspace.slug)}`);
  }
  catch (failure) {
    error.value = (failure as { data?: { data?: { reason?: string } } }).data?.data?.reason
      ?? 'We could not create the workspace.';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Create your workspace
      </h1>
      <p class="mt-2 text-sm text-muted">
        Your links and your team live here.
      </p>
    </div>
    <UForm :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
      <UFormField label="Company or workspace name" name="name" required>
        <UInput v-model="state.name" icon="i-lucide-building-2" placeholder="Acme" />
      </UFormField>
      <UFormField label="Workspace address" name="slug" required>
        <UInput v-model="state.slug" :ui="{ trailing: 'pointer-events-none' }" @input="slugTouched = true">
          <template #trailing>
            <span class="text-xs text-muted">.{{ rootHost }}</span>
          </template>
        </UInput>
        <template #help>
          <span class="text-xs text-muted">You cannot change this later.</span>
        </template>
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Create workspace" block :loading="loading" />
    </UForm>
  </div>
</template>
