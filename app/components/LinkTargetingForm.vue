<script setup lang="ts">
import type { LinkItem } from '~/composables/useLinks';
import { TARGET_OS } from '#shared/link-targeting';

const props = defineProps<{ link: LinkItem }>();
const emit = defineEmits<{ updated: [] }>();

const showError = useErrorToast();
const { saving, saved, patch } = useLinkPatch(() => props.link.id);

const OS_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', desktop: 'Desktop' };

const osRules = reactive<Record<string, string>>({ ios: '', android: '', desktop: '' });
const countryRules = ref<{ code: string; url: string }[]>([]);

watch(() => props.link, (link) => {
  for (const key of TARGET_OS)
    osRules[key] = link.targeting?.os?.[key] ?? '';
  countryRules.value = Object.entries(link.targeting?.country ?? {}).map(([code, url]) => ({ code, url }));
}, { immediate: true });

function addCountry() {
  countryRules.value.push({ code: '', url: '' });
}

function removeCountry(index: number) {
  countryRules.value.splice(index, 1);
}

async function save() {
  const byOs: Record<string, string> = {};
  for (const key of TARGET_OS) {
    const url = osRules[key]?.trim();
    if (url)
      byOs[key] = url;
  }
  const byCountry: Record<string, string> = {};
  for (const rule of countryRules.value) {
    const code = rule.code.trim().toUpperCase();
    const url = rule.url.trim();
    if (code && url)
      byCountry[code] = url;
  }

  try {
    await patch({ targeting: { os: byOs, country: byCountry } });
    emit('updated');
  }
  catch (error: unknown) {
    showError(error);
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-highlighted">
        Targeting
      </h2><p class="mt-0.5 text-xs text-muted">
        Send some visitors somewhere else. A country rule wins over a device rule.
      </p>
    </template>
    <div class="space-y-4">
      <UFormField v-for="key in TARGET_OS" :key="key" :label="OS_LABEL[key]">
        <UInput
          v-model="osRules[key]"
          type="url"
          inputmode="url"
          :aria-label="`${OS_LABEL[key]} destination`"
          placeholder="Use the main destination"
          class="w-full"
        />
      </UFormField>

      <div class="border-t border-default pt-4">
        <h3 class="mb-2 text-xs font-medium text-highlighted">
          Countries
        </h3>
        <div v-for="(rule, index) in countryRules" :key="index" class="mb-2 flex items-start gap-2">
          <UInput
            v-model="rule.code"
            :aria-label="`Country code ${index + 1}`"
            placeholder="DE"
            maxlength="2"
            class="w-20"
          />
          <UInput
            v-model="rule.url"
            type="url"
            inputmode="url"
            :aria-label="`Country destination ${index + 1}`"
            placeholder="https://example.com/de"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            :aria-label="`Remove country rule ${index + 1}`"
            @click="removeCountry(index)"
          />
        </div>
        <UButton label="Add a country" icon="i-lucide-plus" size="xs" color="neutral" variant="outline" @click="addCountry" />
      </div>

      <div class="flex items-center gap-3 border-t border-default pt-4">
        <UButton label="Save targeting" :loading="saving" @click="save" />
        <p v-if="saved" role="status" class="flex items-center gap-1.5 text-xs text-success">
          <UIcon name="i-lucide-circle-check" class="size-3.5" />Targeting saved
        </p>
      </div>
    </div>
  </UCard>
</template>
