import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedId } from '../../prisma/seed/support';

test('uses seeded voice transcription, speech, and safe command interpretation', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@northwind.test');
  await page.getByLabel('Password').fill('DemoPass!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/organization)/);
  expect(
    (
      await page.request.patch('/api/organizations/active', {
        data: { organizationId: seedId('org', 1) },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/inbox/${seedId('conversation', 1)}`);
  const transcribe = page.getByRole('button', { name: 'Transcribe voice note' });
  await expect(transcribe).toBeVisible();
  await transcribe.click();
  await expect(
    page.getByText(/I would like to confirm my appointment tomorrow/),
  ).toBeVisible();

  const speech = await page.request.post('/api/voice/speech', {
    data: { text: 'Appointment confirmed', voice: 'coral' },
  });
  expect(speech.status()).toBe(200);
  expect(speech.headers()['content-type']).toContain('audio/wav');
  const command = await page.request.post('/api/voice/commands/interpret', {
    data: { transcript: 'Draft Your appointment is confirmed' },
  });
  expect((await command.json()).data.command).toMatchObject({
    kind: 'draft_reply',
    requiresConfirmation: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
