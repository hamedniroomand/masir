<script setup lang="ts">
import { loadTurnstile, turnstileOf } from '~/utils/turnstile';

// The token Cloudflare issued, or an empty string while there is none.
const model = defineModel<string>({ required: true });

const { turnstileSiteKey } = useRuntimeConfig().public;
const host = useTemplateRef('host');
let widgetId = '';

onMounted(async () => {
  const turnstile = await loadTurnstile().catch(() => null);
  if (!turnstile || !host.value)
    return;
  widgetId = turnstile.render(host.value, {
    sitekey: turnstileSiteKey,
    theme: 'auto',
    callback: (token: string) => {
      model.value = token;
    },
    'expired-callback': () => {
      model.value = '';
    },
    'error-callback': () => {
      model.value = '';
    },
  });
});

onBeforeUnmount(() => {
  if (widgetId)
    turnstileOf()?.remove(widgetId);
});

// A token is single-use. After a refused submit the visitor needs a new one.
function reset() {
  model.value = '';
  if (widgetId)
    turnstileOf()?.reset(widgetId);
}

defineExpose({ reset });
</script>

<template>
  <div ref="host" data-testid="turnstile" />
</template>
