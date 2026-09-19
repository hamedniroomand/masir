<script setup lang="ts">
const views = [
  {
    icon: 'i-lucide-layout-dashboard',
    title: 'Overview',
    text: 'Clicks, unique visitors, and bot requests for the period you pick, a timeline that goes hourly for a day and daily beyond that, and the five links that got the most clicks.',
    points: ['24 hours, 7 days, 30 days, or all time', 'Bots counted, never mixed into clicks'],
  },
  {
    icon: 'i-lucide-bell-ring',
    title: 'Needs attention',
    text: 'The same page lists what is about to change so nobody finds out from a visitor. Each item opens the link.',
    points: ['Expires within 7 days', 'At 80 percent of its visit cap or more', 'Stopped working in the last 7 days'],
  },
  {
    icon: 'i-lucide-chart-no-axes-combined',
    title: 'One page per link',
    text: 'Every link has its own overview with breakdowns, a settings tab for the rules, and a history tab that shows who changed which field and when.',
    points: ['Referrer, country, device, browser, outcome', 'Human, bot, or all traffic', 'Remaining visits when there is a cap'],
  },
];
</script>

<template>
  <LandingSection
    id="dashboard"
    title="The dashboard answers two questions."
    lead="How is this workspace doing, and what needs attention. Open it after sign-in and both answers are on the first screen."
  >
    <div class="mt-14 grid gap-px overflow-hidden rounded-panel border border-default bg-border md:grid-cols-3">
      <article v-for="view in views" :key="view.title" class="flex flex-col gap-4 bg-default p-6 sm:p-7">
        <UIcon :name="view.icon" class="size-5 text-primary" />
        <h3 class="text-lg font-semibold tracking-tight text-highlighted">
          {{ view.title }}
        </h3>
        <p class="text-sm leading-6 text-muted">
          {{ view.text }}
        </p>
        <ul class="mt-auto space-y-2 border-t border-default pt-4 text-sm text-toned">
          <li v-for="point in view.points" :key="point" class="flex gap-2.5">
            <UIcon name="i-lucide-check" class="mt-1 size-3.5 shrink-0 text-primary" />{{ point }}
          </li>
        </ul>
      </article>
    </div>
  </LandingSection>
</template>
