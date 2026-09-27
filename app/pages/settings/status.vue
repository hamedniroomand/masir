<script setup lang="ts">
definePageMeta({ layout: 'default' });
useHead({ title: 'System status · Masir' });

const { adminStatus: data, pending, error, refresh } = useOperatorStatus();

function formatDate(iso: string | null) {
  if (!iso)
    return 'Never';
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">
        System status
      </h1>
      <p class="page-description">
        Operational health, scheduled maintenance jobs, and service signals for operators.
      </p>
    </div>

    <div v-if="pending" class="space-y-3" role="status" aria-label="Loading system status">
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>

    <div v-else-if="error">
      <UAlert
        title="Could not load system status"
        description="Verify your operator access and try again."
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
      />
      <UButton label="Try again" variant="outline" size="sm" class="mt-4" @click="refresh()" />
    </div>

    <div v-else-if="data" class="space-y-8">
      <!-- Overview summary -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-panel border border-default bg-default p-4">
          <p class="text-xs font-medium text-muted">
            Application version
          </p>
          <p class="mt-1 text-lg font-semibold text-highlighted">
            v{{ data.version }}
          </p>
        </div>
        <div class="rounded-panel border border-default bg-default p-4">
          <p class="text-xs font-medium text-muted">
            Click event partitions
          </p>
          <p class="mt-1 text-sm font-semibold text-highlighted">
            {{ data.partitionsReadyThrough ? `Ready through ${formatDate(data.partitionsReadyThrough)}` : 'Not configured' }}
          </p>
        </div>
        <div class="rounded-panel border border-default bg-default p-4">
          <p class="text-xs font-medium text-muted">
            Active service signals
          </p>
          <p class="mt-1 text-lg font-semibold text-highlighted">
            {{ data.signals.length }} recorded
          </p>
        </div>
      </div>

      <!-- Maintenance Jobs -->
      <section class="space-y-3">
        <h2 class="text-base font-semibold text-highlighted">
          Maintenance jobs
        </h2>
        <div class="rounded-panel border border-default bg-default overflow-hidden">
          <ul class="divide-y divide-default">
            <li v-for="item in data.jobs" :key="item.job" class="p-4 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-mono text-sm font-semibold text-highlighted">{{ item.job }}</span>
                <UBadge
                  :label="item.status === 'failed' ? (item.overdue ? 'Overdue' : 'Failed') : 'OK'"
                  :color="item.status === 'failed' ? 'error' : 'success'"
                  variant="subtle"
                />
              </div>
              <div class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
                <div>Last success: {{ formatDate(item.lastSuccessAt) }}</div>
                <div>Next due: {{ formatDate(item.nextDueAt) }}</div>
              </div>
              <div v-if="item.status === 'failed'" class="mt-2 rounded bg-error/10 p-3 text-xs text-error">
                <p v-if="item.lastError" class="font-medium">
                  Error: {{ item.lastError }}
                </p>
                <p v-if="item.nextAction" class="mt-1 text-muted">
                  Next action: {{ item.nextAction }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Operational Signals -->
      <section class="space-y-3">
        <h2 class="text-base font-semibold text-highlighted">
          Operational signals
        </h2>
        <div v-if="!data.signals.length" class="rounded-panel border border-default bg-default p-6 text-center text-sm text-muted">
          No operational failure signals recorded.
        </div>
        <div v-else class="rounded-panel border border-default bg-default overflow-hidden">
          <ul class="divide-y divide-default">
            <li v-for="signal in data.signals" :key="signal.key" class="p-4 space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-mono text-sm font-semibold text-highlighted">{{ signal.key }}</span>
                <UBadge
                  :label="signal.state"
                  :color="signal.state === 'ok' ? 'success' : 'error'"
                  variant="subtle"
                />
              </div>
              <p class="text-xs text-muted">
                Updated at: {{ formatDate(signal.updatedAt) }}
              </p>
              <pre v-if="signal.detail" class="mt-2 overflow-x-auto rounded bg-muted/20 p-2 font-mono text-xs text-muted">{{ JSON.stringify(signal.detail, null, 2) }}</pre>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>
