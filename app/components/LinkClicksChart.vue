<script setup lang="ts">
const props = defineProps<{
  series: { bucket: string; count: number }[];
  hourly?: boolean;
}>();

const PAD = { top: 18, right: 14, bottom: 28, left: 42 };
const HEIGHT = 208;

const wrap = useTemplateRef<HTMLElement>('wrap');
const { width } = useElementSize(wrap);
const hovered = ref<number | null>(null);

const plotWidth = computed(() => Math.max(80, width.value - PAD.left - PAD.right));
const plotHeight = HEIGHT - PAD.top - PAD.bottom;
const maxCount = computed(() => Math.max(1, ...props.series.map(p => p.count)));

const points = computed(() => props.series.map((p, i) => ({
  ...p,
  x: PAD.left + (props.series.length < 2 ? plotWidth.value / 2 : (i / (props.series.length - 1)) * plotWidth.value),
  y: PAD.top + plotHeight - (p.count / maxCount.value) * plotHeight,
})));

const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '));
const areaPath = computed(() => {
  const pts = points.value;
  if (!pts.length)
    return '';
  const base = PAD.top + plotHeight;
  return `${linePath.value} L${pts.at(-1)!.x} ${base} L${pts[0]!.x} ${base} Z`;
});

const ticks = computed(() => [0, 0.5, 1].map(f => ({
  value: Math.round(maxCount.value * f),
  y: PAD.top + plotHeight - f * plotHeight,
})));

function formatBucket(bucket: string) {
  const d = new Date(bucket);
  return props.hourly
    ? d.toLocaleTimeString(undefined, { hour: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const axisLabels = computed(() => {
  const pts = points.value;
  if (pts.length < 2)
    return pts.map((p, i) => ({ ...p, index: i }));
  const wanted = Math.min(5, pts.length);
  const step = (pts.length - 1) / (wanted - 1);
  return Array.from({ length: wanted }, (_, i) => {
    const index = Math.round(i * step);
    return { ...pts[index]!, index };
  });
});

const peak = computed(() => points.value.reduce((best, p) => (p.count > best.count ? p : best), points.value[0]!));
const active = computed(() => (hovered.value == null ? null : points.value[hovered.value] ?? null));

function onMove(event: PointerEvent) {
  const pts = points.value;
  if (pts.length < 2)
    return;
  const x = event.offsetX - PAD.left;
  const index = Math.round((x / plotWidth.value) * (pts.length - 1));
  hovered.value = Math.min(pts.length - 1, Math.max(0, index));
}
</script>

<template>
  <div ref="wrap" class="relative w-full">
    <svg :width="width || 320" :height="HEIGHT" role="img" :aria-label="`Clicks over time, peak ${peak?.count ?? 0}`" class="overflow-visible">
      <g class="text-muted">
        <line
          v-for="tick in ticks"
          :key="tick.y"
          :x1="PAD.left"
          :x2="PAD.left + plotWidth"
          :y1="tick.y"
          :y2="tick.y"
          stroke="currentColor"
          stroke-width="1"
          opacity="0.18"
        />
      </g>
      <text
        v-for="tick in ticks"
        :key="`label-${tick.y}`"
        :x="PAD.left - 8"
        :y="tick.y + 3"
        text-anchor="end"
        fill="var(--ui-text-muted)"
        class="text-[10px] tabular-nums"
      >{{ tick.value }}</text>

      <g class="text-primary">
        <defs>
          <linearGradient id="clicks-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.22" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#clicks-fill)" />
        <path :d="linePath" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <text
        v-for="(label, i) in axisLabels"
        :key="`x-${label.index}`"
        :x="label.x"
        :y="HEIGHT - 8"
        :text-anchor="i === 0 ? 'start' : i === axisLabels.length - 1 ? 'end' : 'middle'"
        fill="var(--ui-text-muted)"
        class="text-[10px]"
      >{{ formatBucket(label.bucket) }}</text>

      <g v-if="peak && peak.count > 0 && !active" class="text-primary">
        <circle :cx="peak.x" :cy="peak.y" r="4" fill="currentColor" />
        <text
          :x="peak.x"
          :y="peak.y - 10"
          :text-anchor="peak.x >= PAD.left + plotWidth - 12 ? 'end' : peak.x <= PAD.left + 12 ? 'start' : 'middle'"
          fill="var(--ui-text-highlighted)"
          class="text-[10px] font-medium tabular-nums"
        >{{ peak.count }}</text>
      </g>

      <g v-if="active" class="text-primary">
        <line :x1="active.x" :x2="active.x" :y1="PAD.top" :y2="PAD.top + plotHeight" stroke="currentColor" stroke-width="1" opacity="0.4" />
        <circle :cx="active.x" :cy="active.y" r="5" fill="currentColor" stroke="var(--ui-bg)" stroke-width="2" />
      </g>

      <rect
        :x="PAD.left"
        :y="PAD.top"
        :width="plotWidth"
        :height="plotHeight"
        fill="transparent"
        @pointermove="onMove"
        @pointerleave="hovered = null"
      />
    </svg>
    <div
      v-if="active"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-default bg-default px-2.5 py-1.5 text-xs shadow-lg"
      :style="{ left: `${Math.min(Math.max(active.x, 56), (width || 320) - 56)}px`, top: `${active.y - 12}px` }"
    >
      <p class="font-medium tabular-nums text-highlighted">
        {{ active.count }} {{ active.count === 1 ? 'click' : 'clicks' }}
      </p>
      <p class="text-muted">
        {{ formatBucket(active.bucket) }}
      </p>
    </div>
  </div>
</template>
