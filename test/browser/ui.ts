import type { Locator, Page } from '@playwright/test';

// The date picker shows one month at a time and keeps its 23:59 default time.
// Step forward until the month holds the day, then choose it.
export async function pickDate(page: Page, trigger: Locator, date: Date) {
  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  // The popover opens next to the trigger. On a long page the buttons below the
  // calendar then land off screen and never take a click.
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const popover = page.getByRole('dialog').last();
  const next = popover.getByRole('button', { name: 'Next month' });
  await next.waitFor();
  const day = popover.locator(`[data-value="${value}"]:not([data-outside-view])`);
  for (let step = 0; step < 12 && await day.count() === 0; step++)
    await next.click();
  await day.click();
  await popover.getByRole('button', { name: 'Done' }).click();
}

// A Nuxt UI select is a combobox button, not a native select, so the choice
// takes two clicks.
export async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

export const DAY_MS = 86_400_000;

export function inDays(days: number) {
  return new Date(Date.now() + days * DAY_MS);
}
