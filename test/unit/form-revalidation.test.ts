import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, reactive, ref } from 'vue';
import { useFormRevalidation } from '../../app/composables/useFormRevalidation';

function setup() {
  const form = ref({ errors: [] as { id?: string; name?: string; message: string }[], validate: vi.fn(async () => false as const) });
  const state = reactive({ name: '' });
  useFormRevalidation(form, state);
  return { form, state };
}

describe('useFormRevalidation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not validate while the form has never shown an error', async () => {
    const { form, state } = setup();
    state.name = 'a';
    await nextTick();
    vi.runAllTimers();
    expect(form.value.validate).not.toHaveBeenCalled();
  });

  it('validates silently on input after an error appeared', async () => {
    const { form, state } = setup();
    form.value.errors = [{ name: 'name', message: 'Enter a name.' }];
    await nextTick();
    state.name = 'a';
    await nextTick();
    vi.runAllTimers();
    expect(form.value.validate).toHaveBeenCalledWith({ silent: true });
  });

  it('keeps validating after the errors clear', async () => {
    const { form, state } = setup();
    form.value.errors = [{ name: 'name', message: 'Enter a name.' }];
    await nextTick();
    form.value.errors = [];
    await nextTick();
    state.name = 'b';
    await nextTick();
    vi.runAllTimers();
    expect(form.value.validate).toHaveBeenCalledTimes(1);
  });
});
