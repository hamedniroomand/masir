<script setup lang="ts">
import {
  CalendarDate,
  CalendarDateTime,
  DateFormatter,
  getLocalTimeZone,
  Time,
  today,
} from '@internationalized/date';

const model = defineModel<number | null>({ default: null });

const tz = getLocalTimeZone();
const open = ref(false);
const draftDate = shallowRef<CalendarDate>();
const draftTime = shallowRef<Time>();

const df = new DateFormatter('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const minDate = today(tz);

const label = computed(() => {
  if (model.value == null)
    return 'No expiry';
  return df.format(new Date(model.value));
});

function syncDraftFromModel() {
  if (model.value == null) {
    draftDate.value = today(tz);
    draftTime.value = new Time(23, 59);
    return;
  }
  const d = new Date(model.value);
  draftDate.value = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  draftTime.value = new Time(d.getHours(), d.getMinutes());
}

watch(open, (isOpen) => {
  if (isOpen)
    syncDraftFromModel();
});

function apply() {
  if (!draftDate.value) {
    model.value = null;
    open.value = false;
    return;
  }
  const t = draftTime.value ?? new Time(23, 59);
  const dt = new CalendarDateTime(
    draftDate.value.year,
    draftDate.value.month,
    draftDate.value.day,
    t.hour,
    t.minute,
  );
  model.value = dt.toDate(tz).getTime();
  open.value = false;
}

function clear() {
  model.value = null;
  open.value = false;
}
</script>

<template>
  <div class="flex gap-2">
    <UPopover v-model:open="open" class="min-w-0 flex-1">
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        block
        trailing-icon="i-lucide-calendar"
        class="justify-start font-normal"
      >
        <span :class="model == null ? 'text-muted' : ''">{{ label }}</span>
      </UButton>
      <template #content>
        <div class="space-y-3 p-2">
          <UCalendar v-model="draftDate" :min-value="minDate" class="w-full" />
          <UInputTime v-model="draftTime" :hour-cycle="24" variant="outline" class="w-full" />
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              label="Clear"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="clear"
            />
            <UButton type="button" label="Done" size="sm" @click="apply" />
          </div>
        </div>
      </template>
    </UPopover>
    <UButton
      v-if="model != null"
      type="button"
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      aria-label="Clear expiry"
      @click="clear"
    />
  </div>
</template>
