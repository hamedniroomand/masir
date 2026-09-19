<script setup lang="ts">
// A still of the workspace overview, built from the same pieces the app uses.
const DAY = 86_400_000;
const start = Date.UTC(2026, 8, 6);
const counts = [42, 58, 51, 77, 96, 88, 120, 134, 118, 161, 149, 172, 190, 176];
const series = counts.map((count, i) => ({ bucket: new Date(start + i * DAY).toISOString(), count }));

const metrics = [
  { label: 'Clicks', value: '1,532', hint: 'Last 7 days' },
  { label: 'Unique visitors', value: '1,104', hint: 'Rotating daily hash' },
  { label: 'Bot requests', value: '287', hint: 'Kept out of the clicks' },
  { label: 'Links', value: '64', hint: '3 need attention' },
];

const attention = [
  { icon: 'i-lucide-calendar-clock', title: 'Expires within 7 days', slug: 'summit-early-bird', note: 'Sep 24' },
  { icon: 'i-lucide-gauge', title: 'Close to its visit cap', slug: 'beta-invite', note: '184 of 200 visits used' },
  { icon: 'i-lucide-circle-slash', title: 'Stopped working', slug: 'q2-webinar', note: 'Expired Sep 18' },
];

const links = [
  { slug: 'pricing', host: 'acme.example.com/pricing/2026', clicks: '612', status: 'Active', dot: 'bg-success' },
  { slug: 'app', host: 'apps.apple.com · play.google.com', clicks: '388', status: 'Active', dot: 'bg-success', badge: 'Targeted' },
  { slug: 'launch', host: 'acme.example.com/launch', clicks: '0', status: 'Scheduled', dot: 'bg-info' },
];
</script>

<template>
  <div>
    <div class="surface shadow-panel" aria-label="A still of the workspace overview" role="img">
      <div class="flex items-center justify-between gap-3 border-b border-default bg-muted/40 px-5 py-3">
        <div class="flex items-center gap-2.5 text-[13px] font-medium text-highlighted">
          <img src="/icon.svg" alt="" class="size-5 rounded-md">Acme<span class="text-muted">/ Overview</span>
        </div>
        <span class="rounded-md border border-default bg-default px-2 py-1 text-[11px] text-muted shadow-control">Last 7 days</span>
      </div>

      <div class="grid grid-cols-2 divide-y divide-default border-b border-default lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <MetricStat v-for="metric in metrics" :key="metric.label" v-bind="metric" size="md" class="px-5 py-4 sm:px-6 [&:nth-child(2)]:border-s [&:nth-child(2)]:border-default lg:[&:nth-child(2)]:border-s-0 [&:nth-child(4)]:border-s [&:nth-child(4)]:border-default lg:[&:nth-child(4)]:border-s-0" />
      </div>

      <div class="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:divide-x lg:divide-default">
        <div class="px-2 pb-2 pt-4 sm:px-3">
          <p class="px-3 text-xs font-medium text-muted">
            Clicks per day
          </p>
          <LinkClicksChart :series="series" />
        </div>
        <div class="hidden border-t border-default lg:block lg:border-t-0">
          <p class="border-b border-default px-5 py-3 text-xs font-medium text-muted">
            Needs attention
          </p>
          <ul class="divide-y divide-default">
            <li v-for="item in attention" :key="item.slug" class="flex items-start gap-3 px-5 py-3.5">
              <UIcon :name="item.icon" class="mt-0.5 size-4 shrink-0 text-muted" />
              <div class="min-w-0">
                <p class="truncate text-[13px] font-medium text-highlighted">
                  /{{ item.slug }}
                </p>
                <p class="text-xs text-muted">
                  {{ item.title }} · {{ item.note }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-default">
        <div class="hidden grid-cols-[minmax(0,1fr)_100px_80px] bg-muted/70 px-5 py-2.5 text-xs font-medium text-muted sm:grid">
          <span>Link</span><span>Status</span><span class="text-right">Clicks</span>
        </div>
        <ul class="divide-y divide-default">
          <li v-for="link in links" :key="link.slug" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_100px_80px]">
            <div class="flex min-w-0 items-center gap-3">
              <span class="record-icon">{{ link.slug.slice(0, 1).toUpperCase() }}</span>
              <div class="min-w-0">
                <p class="truncate text-[13px] font-medium text-primary">
                  go.acme.com/{{ link.slug }}<span v-if="link.badge" class="ms-2 rounded-md border border-default bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted">{{ link.badge }}</span>
                </p>
                <p class="truncate text-xs text-muted">
                  {{ link.host }}
                </p>
              </div>
            </div>
            <span class="hidden w-fit items-center gap-1.5 rounded-md border border-default bg-default px-2 py-1 text-[11px] font-medium text-toned sm:inline-flex">
              <span class="size-1.5 rounded-full" :class="link.dot" aria-hidden="true" />{{ link.status }}
            </span>
            <span class="text-right text-[13px] font-medium tabular-nums text-highlighted">{{ link.clicks }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
