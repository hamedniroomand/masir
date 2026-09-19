<script setup lang="ts">
import * as v from 'valibot';
import { linkPrefixSchema } from '#shared/link-prefix';
import { normalizeWorkspaceSlug, workspaceSlugSchema } from '#shared/workspace-slug';

const { $api } = useNuxtApp();

definePageMeta({ layout: 'auth' });

const { user } = useUserSession();
const signOut = useSignOut();
const config = useRuntimeConfig();
const rootHost = computed(() => new URL(config.public.shortDomain).host);

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a workspace name.')),
  slug: workspaceSlugSchema,
  linkPrefix: linkPrefixSchema,
});

const state = reactive({ name: '', slug: '', linkPrefix: '' });
const linkExample = computed(() => {
  const path = state.linkPrefix.trim().replace(/^\/+|\/+$/g, '');
  return `${state.slug || 'acme'}.${rootHost.value}/${path ? `${path}/` : ''}abc123`;
});
const form = useTemplateRef('form');
useFormRevalidation(form, state);
const error = ref('');
const loading = ref(false);
const slugTouched = ref(false);
const logo = ref<File | null>(null);
const showError = useErrorToast();

// The address is suggested from the name until the user edits it. It is
// immutable after creation, so they must see it before they submit.
watch(() => state.name, (name) => {
  if (!slugTouched.value)
    state.slug = normalizeWorkspaceSlug(name);
});

// The workspace exists by now, so a failed logo must not block the flow. The
// settings page offers the upload again.
async function uploadLogo(workspaceId: string, file: File) {
  const body = new FormData();
  body.set('workspaceId', workspaceId);
  body.set('file', file);
  try {
    await $api('/api/workspaces/logo', { method: 'POST', body });
  }
  catch (failure) {
    showError(failure);
  }
}

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const workspace = await $api<{ id: string; slug: string }>('/api/workspaces', {
      method: 'POST',
      body: { name: state.name, slug: state.slug, linkPrefix: state.linkPrefix },
    });
    if (logo.value)
      await uploadLogo(workspace.id, logo.value);
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
  <VerifyEmailNotice v-if="user && !user.emailVerified" :email="user.email">
    <UButton label="Sign out" variant="ghost" block @click="signOut" />
  </VerifyEmailNotice>
  <div v-else>
    <div class="mb-7">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        Create your workspace
      </h1>
      <p class="mt-2 text-sm text-muted">
        Your links and your team live here.
      </p>
    </div>
    <UForm ref="form" :schema="schema" :state="state" :validate-on="[]" class="space-y-5" @submit="onSubmit">
      <UFormField label="Logo">
        <WorkspaceLogoField v-model="logo" :name="state.name" :url="null" />
        <template #help>
          <span class="text-xs text-muted">Optional. PNG, JPEG, GIF, or WebP.</span>
        </template>
      </UFormField>
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
      <UFormField label="Link path" name="linkPrefix">
        <UInput v-model="state.linkPrefix" icon="i-lucide-route" placeholder="go" />
        <template #help>
          <span class="text-xs text-muted">Optional. Links look like {{ linkExample }}. Changing it later breaks links you have shared.</span>
        </template>
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">
        {{ error }}
      </p>
      <UButton type="submit" label="Create workspace" block :loading="loading" />
    </UForm>
  </div>
</template>
