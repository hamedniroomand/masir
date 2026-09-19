<script setup lang="ts">
const notStored = ['IP addresses', 'User agent strings', 'Cookies on the visitor', 'Full referrer URLs, only the host'];

const selfHosted = [
  { title: 'One container and Postgres', text: 'Docker Compose for a server, or the Vercel preset with a managed database.' },
  { title: 'Upgrades that only add', text: 'A migration never removes a column in a minor. Old code keeps running against the new schema.' },
  { title: 'Your domain, your data', text: 'Nothing leaves your server. Error reporting and analytics for the app itself stay off until you set a key.' },
];
</script>

<template>
  <LandingSection
    id="privacy"
    title="Analytics you can show anyone."
    lead="Enough to answer whether a link is working, and nothing that could identify the person who clicked."
  >
    <div class="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
      <div>
        <h3 class="text-lg font-semibold tracking-tight text-highlighted">
          Never stored
        </h3>
        <ul class="mt-5 divide-y divide-default border-y border-default">
          <li v-for="item in notStored" :key="item" class="flex items-center gap-3 py-3.5 text-sm text-toned">
            <UIcon name="i-lucide-x" class="size-4 shrink-0 text-muted" />{{ item }}
          </li>
        </ul>
        <p class="mt-5 text-sm leading-6 text-muted">
          Unique visitors come from a hash of a secret, the day, the link, and the request. It rotates at midnight and is only ever counted, never compared with anything outside the database.
        </p>
      </div>
      <div>
        <h3 class="text-lg font-semibold tracking-tight text-highlighted">
          Runs on your server
        </h3>
        <dl class="mt-5 space-y-6">
          <div v-for="item in selfHosted" :key="item.title">
            <dt class="text-sm font-semibold text-highlighted">
              {{ item.title }}
            </dt>
            <dd class="mt-1 text-sm leading-6 text-muted">
              {{ item.text }}
            </dd>
          </div>
        </dl>
        <UButton label="Read the install guide" to="https://hamedniroomand.github.io/masir/guide/installation" target="_blank" rel="noopener" color="neutral" variant="outline" class="mt-8" />
      </div>
    </div>
  </LandingSection>
</template>
