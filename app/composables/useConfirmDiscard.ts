/* eslint-disable no-alert */
import type { MaybeRefOrGetter, Ref } from 'vue';
import { toValue } from 'vue';

export function useConfirmDiscard(
  isDirty: MaybeRefOrGetter<boolean>,
  open?: Ref<boolean>,
) {
  function canDiscard(): boolean {
    if (!toValue(isDirty))
      return true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function')
      return window.confirm('Discard unsaved changes?');
    return true;
  }

  function confirm(action: () => void) {
    if (canDiscard())
      action();
  }

  function handleOpenUpdate(value: boolean) {
    if (value) {
      if (open)
        open.value = true;
      return;
    }
    if (canDiscard()) {
      if (open)
        open.value = false;
    }
  }

  return { canDiscard, confirm, handleOpenUpdate };
}
