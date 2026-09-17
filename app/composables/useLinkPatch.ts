import type { MaybeRefOrGetter } from 'vue';

// patch throws on failure. A switch reports an error with a toast and a form
// reports it on the field, so the caller keeps that choice.
export function useLinkPatch(linkId: MaybeRefOrGetter<string>) {
  const saving = ref(false);
  const saved = ref(false);

  async function patch(body: Record<string, unknown>) {
    saving.value = true;
    saved.value = false;
    try {
      await $fetch(`/api/links/${toValue(linkId)}`, { method: 'PATCH', body });
      saved.value = true;
    }
    finally {
      saving.value = false;
    }
  }

  return { saving, saved, patch };
}
