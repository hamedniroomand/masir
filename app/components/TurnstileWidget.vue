<script setup lang="ts">
import { loadTurnstile, turnstileOf } from '~/utils/turnstile';

// "execute" keeps the box hidden until execute() runs. Cloudflare then shows
// it only when it needs the visitor to click.
const props = defineProps<{ execution?: 'render' | 'execute' }>();
// The token Cloudflare issued, or an empty string while there is none.
const model = defineModel<string>({ required: true });

const { turnstileSiteKey } = useRuntimeConfig().public;
const host = useTemplateRef('host');
let widgetId = '';
let pending: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null;
let markReady: () => void = () => {};
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

onMounted(async () => {
  const turnstile = await loadTurnstile().catch(() => null);
  if (turnstile && host.value) {
    widgetId = turnstile.render(host.value, {
      sitekey: turnstileSiteKey,
      theme: 'auto',
      execution: props.execution ?? 'render',
      appearance: props.execution === 'execute' ? 'interaction-only' : 'always',
      callback: (token: string) => {
        model.value = token;
        pending?.resolve(token);
        pending = null;
      },
      'expired-callback': () => {
        model.value = '';
      },
      'error-callback': () => {
        model.value = '';
        pending?.reject(new Error('Turnstile failed.'));
        pending = null;
      },
    });
  }
  markReady();
});

// Runs the check now and settles with the token. The caller shows its own
// waiting state meanwhile.
async function execute(): Promise<string> {
  await ready;
  if (!widgetId)
    throw new Error('Turnstile did not load.');
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    turnstileOf()?.execute(widgetId);
  });
}

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

defineExpose({ reset, execute });
</script>

<template>
  <div ref="host" data-testid="turnstile" />
</template>
