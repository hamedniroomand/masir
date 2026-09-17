<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'Campaigns · Masir' });

const { data, pending, error, refresh } = useCampaignsList();
const createOpen = ref(false);

async function onCreated() {
  createOpen.value = false;
  await refresh();
}
</script>

<template>
  <div class="space-y-6">
    <div class="page-heading">
      <div>
        <h1 class="page-title">
          Campaigns<UBadge v-if="data && !error" :label="String(data.items.length)" color="neutral" variant="subtle" size="sm" />
        </h1><p class="page-description">
          See how the links in each channel perform together.
        </p>
      </div>
      <UButton label="New campaign" icon="i-lucide-plus" class="shrink-0" @click="createOpen = true" />
    </div>

    <USlideover
      v-model:open="createOpen"
      title="Create a campaign"
      description="Set the utm values every link in this campaign shares."
      :unmount-on-hide="false"
      :ui="{ content: 'sm:max-w-[480px]' }"
    >
      <template #body>
        <CampaignForm @saved="onCreated" />
      </template>
    </USlideover>

    <section aria-label="Campaigns" class="surface">
      <div v-if="pending" class="space-y-4 p-4" role="status" aria-label="Loading campaigns">
        <USkeleton v-for="n in 3" :key="n" class="h-12 w-full" /><span class="sr-only">Loading campaigns</span>
      </div>
      <div v-else-if="error" class="p-5">
        <UAlert title="Could not load campaigns" description="Try again to load your campaigns." color="error" variant="soft" icon="i-lucide-circle-alert" /><UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
      </div>
      <div v-else-if="!data?.items.length" class="relative isolate overflow-hidden px-5 py-20 text-center">
        <BrandPattern variant="edges" />
        <div class="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl border border-default bg-primary/5 text-primary shadow-control">
          <UIcon name="i-lucide-megaphone" class="size-6 text-primary" />
        </div>
        <h2 class="text-sm font-semibold text-highlighted">
          No campaigns yet
        </h2>
        <p class="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted">
          A campaign sets utm_campaign and utm_medium once. Each link in it keeps its own utm_source.
        </p>
        <UButton class="mt-4" label="Create your first campaign" icon="i-lucide-plus" size="sm" @click="createOpen = true" />
      </div>
      <div v-else class="divide-y divide-default">
        <div class="campaign-grid column-heading hidden sm:grid" aria-hidden="true">
          <span>Campaign</span><span class="text-right">Links</span><span class="text-right">Total clicks</span><span />
        </div>
        <NuxtLink
          v-for="campaign in data.items"
          :key="campaign.id"
          :to="`/campaigns/${campaign.id}`"
          class="campaign-grid group px-5 py-5 transition-colors hover:bg-muted/60"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="record-icon bg-primary/5 text-primary">
              <UIcon name="i-lucide-megaphone" class="size-4" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-[13px] font-semibold text-highlighted">
                {{ campaign.name }}
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span class="truncate text-muted">utm_campaign={{ campaign.utmCampaign }}</span><UBadge v-if="campaign.utmMedium" :label="campaign.utmMedium" color="neutral" variant="subtle" size="sm" />
              </div>
            </div>
          </div>
          <dl class="flex shrink-0 gap-6 ps-13 text-xs sm:contents sm:text-right">
            <div class="sm:justify-self-end">
              <dt class="text-muted sm:sr-only">
                Links
              </dt><dd class="font-medium tabular-nums text-highlighted sm:text-sm">
                {{ campaign.linkCount }}
              </dd>
            </div>
            <div class="sm:justify-self-end">
              <dt class="text-muted sm:sr-only">
                Clicks
              </dt><dd class="font-medium tabular-nums text-highlighted sm:text-sm">
                {{ campaign.clickCount.toLocaleString() }}
              </dd>
            </div>
          </dl>
          <UIcon name="i-lucide-chevron-right" class="hidden size-4 text-dimmed group-hover:text-primary sm:block" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
