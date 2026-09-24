<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';

const props = defineProps<{
  workspaceId: string;
}>();

const emit = defineEmits<{
  createLink: [];
}>();

const { copy, copied } = useClipboard();

type StoredState = {
  dismissed: boolean;
  shared: boolean;
  inspected: boolean;
};

const storageKey = computed(() => `masir:first-use:${props.workspaceId}`);
const dismissed = ref(false);
const shared = ref(false);
const inspected = ref(false);

onMounted(() => {
  try {
    const raw = localStorage.getItem(storageKey.value);
    if (raw) {
      if (raw === 'dismissed') {
        dismissed.value = true;
      }
      else {
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        dismissed.value = Boolean(parsed.dismissed);
        shared.value = Boolean(parsed.shared);
        inspected.value = Boolean(parsed.inspected);
      }
    }
  }
  catch {
    // Ignore storage parse issues
  }
});

function saveState() {
  try {
    localStorage.setItem(
      storageKey.value,
      JSON.stringify({
        dismissed: dismissed.value,
        shared: shared.value,
        inspected: inspected.value,
      }),
    );
  }
  catch {
    // Ignore storage issues
  }
}

function dismiss() {
  dismissed.value = true;
  saveState();
}

function onShare(shortUrl: string) {
  copy(shortUrl);
  shared.value = true;
  saveState();
}

function onInspect() {
  inspected.value = true;
  saveState();
}

const { data: linksData } = useApi<{ items: LinkItem[]; total: number }>('/api/links', {
  query: computed(() => ({ perPage: 10 })),
});

const linkCount = computed(() => linksData.value?.total ?? 0);
const firstLink = computed(() => linksData.value?.items?.[0] ?? null);
const hasClicks = computed(() => (linksData.value?.items ?? []).some(item => item.clickCount > 0));

const createdStep = computed(() => linkCount.value > 0);
const sharedStep = computed(() => shared.value || hasClicks.value);
const inspectedStep = computed(() => inspected.value);

const { isOperator } = useOperatorStatus();

const visible = computed(() => !dismissed.value && linkCount.value < 3);
</script>

<template>
  <div v-if="visible" class="surface relative isolate overflow-hidden p-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-sm font-semibold text-highlighted">
          Getting started with Masir
        </h2>
        <p class="mt-1 text-xs text-muted">
          Complete these steps to set up your workspace and start sharing stable links.
        </p>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Dismiss checklist"
        @click="dismiss"
      />
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <!-- Step 1: Create a link -->
      <div
        class="flex flex-col justify-between rounded-lg border p-3"
        :class="createdStep ? 'border-success/30 bg-success/5' : 'border-default bg-muted/20'"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="createdStep ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            class="size-4 shrink-0"
            :class="createdStep ? 'text-success' : 'text-muted'"
          />
          <span class="text-xs font-medium text-highlighted">1. Create a link</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          Shorten your first destination address.
        </p>
        <div class="mt-3">
          <UButton
            v-if="!createdStep"
            size="xs"
            label="Create link"
            icon="i-lucide-plus"
            @click="emit('createLink')"
          />
          <span v-else class="text-xs font-medium text-success">Completed</span>
        </div>
      </div>

      <!-- Step 2: Share it -->
      <div
        class="flex flex-col justify-between rounded-lg border p-3"
        :class="sharedStep ? 'border-success/30 bg-success/5' : 'border-default bg-muted/20'"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="sharedStep ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            class="size-4 shrink-0"
            :class="sharedStep ? 'text-success' : 'text-muted'"
          />
          <span class="text-xs font-medium text-highlighted">2. Share it</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          Copy the short address or download its QR code.
        </p>
        <div class="mt-3">
          <template v-if="createdStep && !sharedStep && firstLink">
            <UButton
              size="xs"
              :label="copied ? 'Copied' : 'Copy address'"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              color="neutral"
              variant="outline"
              @click="onShare(firstLink.shortUrl)"
            />
          </template>
          <span v-else-if="sharedStep" class="text-xs font-medium text-success">Completed</span>
          <span v-else class="text-xs text-muted">Create a link first</span>
        </div>
      </div>

      <!-- Step 3: Inspect it -->
      <div
        class="flex flex-col justify-between rounded-lg border p-3"
        :class="inspectedStep ? 'border-success/30 bg-success/5' : 'border-default bg-muted/20'"
      >
        <div class="flex items-center gap-2">
          <UIcon
            :name="inspectedStep ? 'i-lucide-circle-check' : 'i-lucide-circle'"
            class="size-4 shrink-0"
            :class="inspectedStep ? 'text-success' : 'text-muted'"
          />
          <span class="text-xs font-medium text-highlighted">3. Inspect it</span>
        </div>
        <p class="mt-2 text-xs text-muted">
          Check analytics, rules, or destination history.
        </p>
        <div class="mt-3">
          <template v-if="createdStep && firstLink">
            <NuxtLink
              :to="`/links/${firstLink.id}`"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              @click="onInspect"
            >
              View analytics <UIcon name="i-lucide-arrow-right" class="size-3" />
            </NuxtLink>
          </template>
          <span v-else class="text-xs text-muted">Create a link first</span>
        </div>
      </div>
    </div>

    <!-- Operator Setup (only when GET /api/admin/status is 200) -->
    <div v-if="isOperator" class="mt-4 border-t border-default pt-3">
      <p class="mb-2 text-xs font-medium text-muted">
        Operator setup
      </p>
      <div class="flex flex-wrap items-center gap-4 text-xs">
        <NuxtLink to="/settings/status" class="flex items-center gap-1.5 text-highlighted hover:text-primary">
          <UIcon name="i-lucide-mail" class="size-3.5 text-muted" /> Mail delivery
        </NuxtLink>
        <NuxtLink to="/settings/status" class="flex items-center gap-1.5 text-highlighted hover:text-primary">
          <UIcon name="i-lucide-hard-drive" class="size-3.5 text-muted" /> File storage
        </NuxtLink>
        <NuxtLink to="/settings/status" class="flex items-center gap-1.5 text-highlighted hover:text-primary">
          <UIcon name="i-lucide-activity" class="size-3.5 text-muted" /> Maintenance jobs
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
