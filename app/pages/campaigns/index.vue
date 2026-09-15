<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Campaigns · Linkyard' });

const { data, pending, error, refresh } = useCampaignsList();
const createOpen = ref(false);

async function onCreated() {
  createOpen.value = false;
  await refresh();
}
</script>

<template>
  <div class="space-y-7">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">
          Campaigns
        </h1>
        <p class="mt-2 text-sm text-muted">
          Group links that belong together and see how each channel performs.
        </p>
      </div>
      <UModal v-model:open="createOpen" title="Create a campaign" description="Set the utm values every link in this campaign shares.">
        <UButton label="New campaign" icon="i-lucide-plus" size="lg" class="shrink-0" />
        <template #body>
          <CampaignForm @saved="onCreated" />
        </template>
      </UModal>
    </div>

    <div v-if="pending" class="space-y-4" role="status" aria-label="Loading campaigns">
      <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
    </div>
    <div v-else-if="error">
      <UAlert title="Could not load campaigns" description="Try again to load your campaigns." color="error" variant="soft" icon="i-lucide-circle-alert" />
      <UButton label="Try again" variant="outline" class="mt-4" @click="refresh()" />
    </div>
    <div v-else-if="!data?.items.length" class="rounded-xl border border-default bg-default px-5 py-16 text-center">
      <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-default bg-muted">
        <UIcon name="i-lucide-megaphone" class="size-6 text-primary" />
      </div>
      <h2 class="font-semibold text-highlighted">
        No campaigns yet
      </h2>
      <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        A campaign sets utm_campaign and utm_medium once. Each link in it keeps its own utm_source.
      </p>
      <UButton class="mt-5" label="Create your first campaign" icon="i-lucide-plus" @click="createOpen = true" />
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="campaign in data.items"
        :key="campaign.id"
        :to="`/campaigns/${campaign.id}`"
        class="rounded-xl border border-default bg-default p-5 transition hover:border-primary/40"
      >
        <h2 class="truncate font-semibold text-highlighted">
          {{ campaign.name }}
        </h2>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <UBadge :label="`utm_campaign=${campaign.utmCampaign}`" color="neutral" variant="subtle" size="sm" />
          <UBadge v-if="campaign.utmMedium" :label="`utm_medium=${campaign.utmMedium}`" color="neutral" variant="subtle" size="sm" />
        </div>
        <div class="mt-5 flex gap-6 border-t border-default pt-4">
          <div>
            <p class="text-xs text-muted">
              Links
            </p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-highlighted">
              {{ campaign.linkCount }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted">
              Clicks
            </p>
            <p class="mt-1 text-xl font-semibold tabular-nums text-highlighted">
              {{ campaign.clickCount.toLocaleString() }}
            </p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
