import type { FormErrorWithId } from '@nuxt/ui';
import type { Ref } from 'vue';
import { watchDebounced } from '@vueuse/core';
import { ref, watch } from 'vue';

type RevalidatingForm = {
  errors: FormErrorWithId[];
  validate: (opts: { silent: true }) => Promise<unknown>;
};

// Forms validate on submit only. Once an error has shown, re-validate as the
// user edits so a field leaves the error state as soon as its input is valid.
export function useFormRevalidation(form: Readonly<Ref<RevalidatingForm | null | undefined>>, state: object) {
  const shown = ref(false);
  const edited = ref(false);

  watch(() => form.value?.errors.length, (count) => {
    if (!count)
      return;
    shown.value = true;
    // A debounce from before the errors must not clear them. The server refused
    // this input and the user has not changed it, so nothing became valid.
    edited.value = false;
  });

  watch(state, () => {
    edited.value = true;
  }, { deep: true });

  watchDebounced(state, () => {
    if (shown.value && edited.value)
      form.value?.validate({ silent: true });
  }, { deep: true, debounce: 300 });
}
