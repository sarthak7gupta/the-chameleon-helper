import { test, expect } from '@playwright/test';
test('three phones play a complete round, refresh, private cards, and mobile layout', async ({ browser }) => {
  test.setTimeout(60_000);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors = []; pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  try {
    const [host] = pages; await host.goto('/');
    await host.getByLabel('Your display name').fill('Ada'); await host.getByRole('button', { name: 'Create a room' }).click();
    await expect(host.getByText('The table is open.')).toBeVisible();
    const code = new URL(host.url()).searchParams.get('room');
    for (let i = 1; i < 3; i++) { const p = pages[i]; await p.goto(`/?room=${code}`); await p.getByLabel('Your display name').fill(['', 'Grace', 'Linus'][i]); await p.getByRole('button', { name: 'Join room', exact: true }).click(); }
    await expect(host.getByText('3 at the table')).toBeVisible();
    await host.getByRole('button', { name: 'Deal the cards' }).click();
    const chameleons = [];
    for (const p of pages) {
      const card = p.getByRole('button', { name: 'Reveal your card' }); await card.click();
      chameleons.push(await p.locator('#reveal-role').innerText());
      await p.getByRole('button', { name: 'I’m ready' }).click();
      await expect(p.getByRole('button', { name: 'I’m ready' })).not.toBeVisible();
    }
    expect(chameleons.filter(t => t.includes('The Chameleon'))).toHaveLength(1);
    await host.reload();
    const state = await host.evaluate(async () => (await fetch('./api/rooms/' + new URLSearchParams(location.search).get('room'))).json());
    for (const id of state.order) {
      let player;
      for (const p of pages) { const s = await p.evaluate(async () => (await fetch('./api/rooms/' + new URLSearchParams(location.search).get('room'))).json()); if (s.me === id) player = p; }
      await player.getByLabel('Your one-word clue').fill('Subtle'); await player.getByRole('button', { name: 'Share clue' }).click();
    }
    await host.getByRole('button', { name: 'Open voting' }).click();
    for (const p of pages) { await p.getByRole('button', { name: 'Ada', exact: true }).click(); await expect(p.getByRole('button', { name: 'Ada', exact: true })).not.toBeVisible(); }
    for (const p of pages) {
      const r = await p.evaluate(async () => (await fetch('./api/rooms/' + new URLSearchParams(location.search).get('room'))).json());
      if (r.phase === 'guess' && r.role === 'chameleon') {
        await p.getByLabel('The secret word').fill('DefinitelyWrong'); await p.getByRole('button', { name: 'Make my guess' }).click();
        await expect(p.getByText('Guess the secret word. 1 guess left.')).toBeVisible();
        await p.getByLabel('The secret word').fill('StillWrong'); await p.getByRole('button', { name: 'Make my guess' }).click();
        await expect(p.getByRole('button', { name: 'Make my guess' })).not.toBeVisible();
      }
    }
    await expect(host.getByRole('button', { name: 'Next round' })).toBeVisible();
    expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await host.getByRole('button', { name: 'How to play' }).click(); await expect(host.getByRole('dialog')).toBeVisible();
    await host.keyboard.press('Escape'); await expect(host.getByRole('dialog')).not.toBeVisible();
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
