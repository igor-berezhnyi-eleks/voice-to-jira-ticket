import { expect, test } from '@playwright/test';

// Runs the real API with the fake generator (see playwright.config.ts). The fake picks Bug when the
// transcript contains words like "crash", and Feature otherwise.
const bugTranscript = 'The export button crashes the app every time I click it on the reports page.';
const featureTranscript = 'It would be great to add a dark mode setting to the profile page for night work.';

test('bug flow: transcript to edited, copied ticket and back', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Transcript').fill(bugTranscript);
  await page.getByRole('button', { name: 'Generate ticket' }).click();

  await expect(page.getByRole('heading', { name: 'Review ticket' })).toBeVisible();
  await expect(page.locator('.badge')).toHaveText('Bug');
  await expect(page.getByText('Fake generator active')).toBeVisible();

  const preview = page.getByLabel('Preview', { exact: true });
  await page.getByLabel('Title', { exact: true }).fill('Export crashes the reports page');
  await expect(preview).toHaveValue(/Export crashes the reports page/);
  const plainText = await preview.inputValue();

  await page.getByRole('radio', { name: 'Jira wiki' }).check();
  await expect(preview).not.toHaveValue(plainText);
  const wikiText = await preview.inputValue();

  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByText('Copied')).toBeVisible();
  // Chromium on Windows reads clipboard text back with CRLF line breaks; the text itself is the same.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, '\n')).toBe(wikiText);

  // The title was edited, so Back asks before discarding.
  await page.getByRole('button', { name: /^Back/ }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByLabel('Transcript')).toHaveValue(bugTranscript);
});

test('feature flow: a feature-style transcript gives a Feature', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Transcript').fill(featureTranscript);
  await page.getByRole('button', { name: 'Generate ticket' }).click();

  await expect(page.getByRole('heading', { name: 'Review ticket' })).toBeVisible();
  await expect(page.locator('.badge')).toHaveText('Feature');
});
