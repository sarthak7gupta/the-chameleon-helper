import { test, expect } from '@playwright/test';
test('guest finds a public table without an account; private room stays hidden', async ({ browser }, testInfo) => {
  const publicName = `Public ${testInfo.project.name}`;
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const [host, guest, privateHost] = await Promise.all(contexts.map(c => c.newPage()));
  try {
    await privateHost.goto('/'); await privateHost.getByLabel('Your display name').fill('Private');
    await privateHost.getByRole('button', { name: 'Create a room' }).click(); await expect(privateHost.getByText('The table is open.')).toBeVisible();
    await host.goto('/'); await host.getByLabel('Your display name').fill(publicName);
    await host.getByLabel('Room visibility').selectOption('public'); await host.getByRole('button', { name: 'Create a room' }).click();
    await expect(host.getByText('The table is open.')).toBeVisible();
    await guest.goto('/'); await guest.getByLabel('Your display name').fill('Guest');
    await expect(guest.getByRole('heading', { name: `${publicName}’s table`, exact: true })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Private’s table', exact: true })).not.toBeVisible();
    await guest.getByRole('button', { name: `Join table ${publicName}’s table` }).click();
    await expect(guest.getByText('2 at the table')).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
