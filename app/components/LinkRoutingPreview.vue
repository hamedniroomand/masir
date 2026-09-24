<script setup lang="ts">
import type { RedirectDecision, RedirectRule } from '#shared/redirect-decision';
import { CalendarDate, CalendarDateTime, DateFormatter, getLocalTimeZone, Time, today } from '@internationalized/date';

const props = defineProps<{ linkId: string }>();

const { $api } = useNuxtApp();
const showError = useErrorToast();

type PreviewResult = RedirectDecision & {
  rule: RedirectRule | null;
  linkState: string | null;
};

const country = ref('__none__');
const device = ref<'ios' | 'android' | 'desktop' | 'other'>('desktop');
const atTime = ref<number | null>(null);
const loading = ref(false);
const result = ref<PreviewResult | null>(null);

const zone = getLocalTimeZone();
const timeOpen = ref(false);
const draftDate = shallowRef<CalendarDate>();
const draftTime = shallowRef<Time>();

const formatter = new DateFormatter('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const timeLabel = computed(() => {
  if (atTime.value == null)
    return 'Now';
  return formatter.format(new Date(atTime.value));
});

function syncDraftFromModel() {
  if (atTime.value == null) {
    draftDate.value = today(zone);
    draftTime.value = new Time(12, 0);
    return;
  }
  const date = new Date(atTime.value);
  draftDate.value = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  draftTime.value = new Time(date.getHours(), date.getMinutes());
}

whenever(timeOpen, syncDraftFromModel);

function applyTime() {
  if (!draftDate.value) {
    atTime.value = null;
    timeOpen.value = false;
    return;
  }
  const time = draftTime.value ?? new Time(12, 0);
  const stamp = new CalendarDateTime(
    draftDate.value.year,
    draftDate.value.month,
    draftDate.value.day,
    time.hour,
    time.minute,
  );
  atTime.value = stamp.toDate(zone).getTime();
  timeOpen.value = false;
}

function clearTime() {
  atTime.value = null;
  timeOpen.value = false;
}

const countryItems = [
  { label: 'No country', value: '__none__' },
  { label: 'US — United States', value: 'US' },
  { label: 'DE — Germany', value: 'DE' },
  { label: 'GB — United Kingdom', value: 'GB' },
  { label: 'FR — France', value: 'FR' },
  { label: 'IR — Iran', value: 'IR' },
  { label: 'CA — Canada', value: 'CA' },
  { label: 'AU — Australia', value: 'AU' },
  { label: 'BR — Brazil', value: 'BR' },
  { label: 'IN — India', value: 'IN' },
  { label: 'JP — Japan', value: 'JP' },
  { label: 'NL — Netherlands', value: 'NL' },
];

const osItems = [
  { label: 'Desktop', value: 'desktop' },
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
  { label: 'Other', value: 'other' },
];

const RULE_LABEL: Record<string, string> = {
  country: 'Country rule',
  os: 'Device rule',
  default: 'Default destination',
  expired_fallback: 'Expired fallback',
  limit_fallback: 'Visit limit fallback',
  scheduled_fallback: 'Scheduled fallback',
};

const STATE_LABEL: Record<string, string> = {
  disabled: 'Disabled',
  expired: 'Expired',
  limit_reached: 'Visit limit reached',
  scheduled: 'Not open yet',
};

const matchedRule = computed(() => {
  const value = result.value;
  if (!value)
    return '';
  if (value.kind === 'password')
    return 'Password required';
  if (value.kind === 'block')
    return STATE_LABEL[value.linkState] ?? value.linkState;
  return RULE_LABEL[value.rule] ?? value.rule;
});

const destination = computed(() => {
  const value = result.value;
  if (!value || value.kind !== 'redirect')
    return null;
  return value.destination;
});

async function runPreview() {
  loading.value = true;
  try {
    result.value = await $api<PreviewResult>(`/api/links/${props.linkId}/preview`, {
      method: 'POST',
      body: {
        country: country.value === '__none__' ? null : country.value,
        os: device.value,
        at: atTime.value != null ? new Date(atTime.value).toISOString() : null,
      },
    });
  }
  catch (error: unknown) {
    showError(error);
  }
  finally {
    loading.value = false;
  }
}

onMounted(() => {
  void runPreview();
});

watch([country, device, atTime], () => {
  void runPreview();
});
</script>

<template>
  <div role="region" aria-label="Routing preview">
    <UCard>
      <template #header>
        <h2 class="text-sm font-semibold text-highlighted">
          Preview routing
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          Preview checks routing rules. It does not check that the destination works.
        </p>
      </template>

      <div class="space-y-4">
        <div class="grid items-start gap-3 sm:grid-cols-3">
          <UFormField label="Country">
            <USelect
              v-model="country"
              :items="countryItems"
              aria-label="Country"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Device">
            <USelect
              v-model="device"
              :items="osItems"
              aria-label="Device"
              class="w-full"
            />
          </UFormField>
          <UFormField label="At time">
            <div class="flex gap-2">
              <UPopover v-model:open="timeOpen" class="min-w-0 flex-1">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  block
                  trailing-icon="i-lucide-calendar"
                  class="justify-start font-normal"
                >
                  <span :class="atTime == null ? 'text-muted' : ''">{{ timeLabel }}</span>
                </UButton>
                <template #content>
                  <div class="space-y-3 p-2">
                    <UCalendar v-model="draftDate" class="w-full" />
                    <UInputTime v-model="draftTime" :hour-cycle="24" variant="outline" class="w-full" />
                    <div class="flex justify-end gap-2">
                      <UButton type="button" label="Now" color="neutral" variant="ghost" size="sm" @click="clearTime" />
                      <UButton type="button" label="Done" size="sm" @click="applyTime" />
                    </div>
                  </div>
                </template>
              </UPopover>
              <UButton
                v-if="atTime != null"
                type="button"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                aria-label="Reset to now"
                @click="clearTime"
              />
            </div>
          </UFormField>
        </div>

        <div
          v-if="result"
          role="status"
          class="space-y-2 rounded-lg border border-default bg-muted/40 px-4 py-3 text-sm"
          :aria-busy="loading"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">Matched rule</span>
            <span class="font-medium text-highlighted">{{ matchedRule }}</span>
            <UIcon v-if="loading" name="i-lucide-loader-circle" class="ms-auto size-3.5 animate-spin text-muted" />
          </div>
          <div v-if="destination" class="flex items-start gap-2">
            <span class="shrink-0 text-xs text-muted">Destination</span>
            <a
              :href="destination"
              target="_blank"
              rel="noopener noreferrer"
              class="break-all text-toned hover:text-primary"
            >{{ destination }}</a>
          </div>
          <p v-else-if="result.kind === 'password'" class="text-xs text-muted">
            A visitor must unlock this link before a destination is chosen.
          </p>
          <p v-else-if="result.kind === 'block'" class="text-xs text-muted">
            A visitor would see an unavailable response.
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
