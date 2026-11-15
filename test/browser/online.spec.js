import { test, expect } from '@playwright/test';
test('a guest can create an account, stay signed in across a reload, and sign out', async ({ page }, testInfo) => {
  const name = `Tester ${testInfo.project.name}`;
  await page.goto('/');
  await page.getByLabel('Account name').fill(name);
  await page.getByLabel('Password').fill('longenough8');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(`Signed in as ${name}`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Signed in as ${name}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your display name')).toHaveValue(name);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Account name')).toBeVisible();
});
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
