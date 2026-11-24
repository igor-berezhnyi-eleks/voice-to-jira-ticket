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
  await expect(page.getByLabel('Type')).toHaveValue('Bug');
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
  await expect(page.getByLabel('Type')).toHaveValue('Feature');
});

test('type picker: a Bug converts to a Feature in the browser and the fake can regenerate it as one', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Transcript').fill(bugTranscript);
  await page.getByRole('button', { name: 'Generate ticket' }).click();
  await expect(page.getByLabel('Type')).toHaveValue('Bug');

  await page.getByLabel('Type').selectOption('Feature');
  await expect(page.getByText('Converted from Bug in your browser.')).toBeVisible();
  await expect(page.getByLabel('Proposed behavior')).toBeVisible();
  await expect(page.getByLabel('Actual result')).toHaveCount(0);

  // The fake obeys the requested type, so this is a Feature from the server even though the transcript says "crashes".
  await page.getByRole('button', { name: 'Regenerate as Feature' }).click();
  await expect(page.getByText('Converted from Bug')).toHaveCount(0);
  await expect(page.getByLabel('Type')).toHaveValue('Feature');
  await expect(page.getByLabel('Proposed behavior')).toBeVisible();
});

test('translate: the fake translator replaces the text, Undo restores it, Generate uses the box', async ({ page }) => {
  await page.goto('/');
  const box = page.getByLabel('Transcript');
  // The fake translator takes mostly-Cyrillic text for Ukrainian and anything else for English.
  const ukrainian = 'Кнопка експорту падає щоразу, коли я натискаю її на сторінці звітів.';
  await box.fill(ukrainian);

  await page.getByRole('button', { name: 'Translate to English' }).click();
  await expect(page.getByText('Translated from Ukrainian')).toBeVisible();
  await expect(box).toHaveValue(/^\[en\] /);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(box).toHaveValue(ukrainian);
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('header steps: Report to Review and back, with the question when Page 2 has edits', async ({ page }) => {
  await page.goto('/');
  const progress = page.getByLabel('Progress');
  await page.getByLabel('Transcript').fill(bugTranscript);

  await progress.getByRole('button', { name: /Review/ }).click();
  await expect(page.getByRole('heading', { name: 'Review ticket' })).toBeVisible();
  await expect(progress.getByRole('button', { name: /Review/ })).toHaveCount(0);

  await page.getByLabel('Title', { exact: true }).fill('Export crashes the reports page');
  await progress.getByRole('button', { name: /Report/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Export crashes the reports page');

  // Keyboard only: focus the step and press Enter.
  await progress.getByRole('button', { name: /Report/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByLabel('Transcript')).toHaveValue(bugTranscript);
});
