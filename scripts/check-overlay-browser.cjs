// Optional tooling: npm install --prefix .tmp/visual-tools --no-save --package-lock=false playwright
const { chromium } = require('../.tmp/visual-tools/node_modules/playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = process.cwd();
  const { seedDemo } = await import(pathToFileURL(path.join(root, 'server/bracket-engine.js')));
  const { defaultDesign } = await import(pathToFileURL(path.join(root, 'public/js/overlay-design.js')));
  const dir = path.join(root, '.tmp/visual-check');
  await fs.mkdir(dir, { recursive: true });
  const data = seedDemo();
  await fs.writeFile(path.join(dir, 'tournament.json'), JSON.stringify(data));
  await fs.writeFile(path.join(dir, 'streaming.json'), '{}');
  const server = spawn(process.execPath, ['server/app.js'], { cwd: root, env: { ...process.env, PORT: '0', NODE_ENV: 'test', ADMIN_USER: 'visual-test', ADMIN_PASSWORD: 'visual-test-password', SESSION_SECRET: 'visual-test-session-secret-32-characters', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', DATA_FILE: path.join(dir, 'tournament.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    let output = '';
    server.stdout.on('data', chunk => output += chunk);
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    const deadline = Date.now() + 10000;
    while (!output.includes('listening on')) {
      if (Date.now() > deadline || server.exitCode !== null) throw new Error('server startup failed');
      await new Promise(r => setTimeout(r, 30));
    }
    const origin = `http://127.0.0.1:${output.match(/listening on (\d+)/)[1]}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    assert.equal((await context.request.post(origin + '/api/login', { data: { username: 'visual-test', password: 'visual-test-password' } })).status(), 200);
    const patch = async (url, body) => {
      const res = await context.request.patch(origin + url, { data: body });
      assert.equal(res.status(), 200, await res.text());
    };
    await patch('/api/matches/r1-m1', { state: 'LIVE', scoreA: 2, scoreB: 1 });
    const overlay = await context.newPage();
    await overlay.goto(origin + '/overlay-ingame.html');
    await overlay.locator('#scoreboard').waitFor({ state: 'visible' });
    await overlay.evaluate(() => document.fonts.ready);
    async function metrics(page) {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return page.evaluate(() => {
        const blue = document.querySelector('.blue').getBoundingClientRect();
        const red = document.querySelector('.red').getBoundingClientRect();
        return { gap: red.left - blue.right, background: getComputedStyle(document.body).backgroundColor,
          names: ['blue', 'red'].map(side => {
            const n = document.getElementById(`${side}-name`), s = getComputedStyle(n);
            const range = document.createRange(); range.selectNodeContents(n);
            const bounds = range.getBoundingClientRect(), box = n.getBoundingClientRect();
            return { text: n.textContent, size: parseFloat(s.fontSize), fill: s.color, stroke: s.webkitTextStrokeWidth, shadow: s.textShadow, fits: bounds.width <= box.width + 1, centered: Math.abs((bounds.left + bounds.right) / 2 - (box.left + box.right) / 2) < 2, transform: s.transform };
          }) };
      });
    }
    const short = await metrics(overlay);
    assert.equal(short.gap, 420);
    assert.equal(short.background, 'rgba(0, 0, 0, 0)');
    assert(short.names.every(n => n.fill === 'rgb(255, 255, 255)' && n.fits && n.centered && n.size >= 40 && n.transform === 'none'));
    await overlay.screenshot({ path: path.join(dir, 'default-short-1920.png'), clip: { x: 0, y: 0, width: 1920, height: 170 }, omitBackground: true });
    await overlay.setViewportSize({ width: 865, height: 200 });
    await overlay.screenshot({ path: path.join(dir, 'default-short-865.png'), omitBackground: true });
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 1280, height: 1150 });
    await panel.goto(origin + '/streaming');
    await panel.locator('#settings').waitFor({ state: 'visible' });
    const preview = panel.frameLocator('#overlay-preview');
    await preview.locator('#scoreboard').waitFor({ state: 'visible' });
    const before = await (await context.request.get(origin + '/api/tournament')).json();
    await panel.locator('[data-design="nameSize"]').fill('');
    await panel.waitForTimeout(250);
    assert.equal((await (await context.request.get(origin + '/api/streaming')).json()).settings.nameSize, 48, 'an unfinished numeric edit must not save a zero size');
    // Every control must update preview, persist, then reach the OBS page.
    const controls = { nameSize: 60, fontFamily: 'impact', blueColor: '#245cb5', redColor: '#bd2638', textColor: '#ffd600', textStroke: .4, shadowOffset: 1, blockWidth: 700, centerGap: 500, shimmer: false };
    for (const [key, value] of Object.entries(controls)) {
      const input = panel.locator(`[data-design="${key}"]`);
      if (typeof value === 'boolean') await input.setChecked(value);
      else if (key === 'fontFamily') await input.selectOption(value);
      else await input.fill(String(value));
    }
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    const saved = await (await context.request.get(origin + '/api/streaming')).json();
    for (const [key, value] of Object.entries(controls)) assert.equal(saved.settings[key], value);
    await overlay.waitForFunction(() => getComputedStyle(document.getElementById('blue-name')).color === 'rgb(255, 214, 0)');
    await preview.locator('#scoreboard').evaluate(el => { if (el.style.getPropertyValue('--centerGap') !== '500') throw new Error('preview not updated'); });
    assert.deepEqual(await (await context.request.get(origin + '/api/tournament')).json(), before);
    await panel.reload();
    await panel.locator('#settings').waitFor({ state: 'visible' });
    assert.equal(await panel.locator('[data-design="nameSize"]').inputValue(), '60');
    assert.equal(await panel.locator('[data-design="fontFamily"]').inputValue(), 'impact');
    await panel.screenshot({ path: path.join(dir, 'customization-panel.png'), fullPage: true });
    await panel.locator('#reset-design').click();
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    const reset = await (await context.request.get(origin + '/api/streaming')).json();
    for (const [key, value] of Object.entries(defaultDesign)) assert.equal(reset.settings[key], value);
    // Preview updates even while saving is deliberately delayed; OBS waits for persistence.
    let release;
    await panel.route('**/api/streaming', async route => {
      if (route.request().method() === 'PATCH') await new Promise(resolve => release = resolve);
      await route.continue();
    });
    await panel.locator('[data-design="textColor"]').fill('#b8ffcd');
    await preview.locator('#blue-name').evaluate(el => { if (getComputedStyle(el).color !== 'rgb(184, 255, 205)') throw new Error('preview did not update immediately'); });
    await panel.waitForTimeout(250);
    assert(release);
    release();
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    await panel.unroute('**/api/streaming', undefined, { behavior: 'wait' });
    await panel.locator('#reset-design').click();
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    // Long names come from the real bracket, not Streaming or fake browser text.
    const participants = before.participants.map(p => ({ ...p }));
    participants[0].name = 'LOS GUERREROS DEL MULTIVERSO COMPETITIVO';
    participants[1].name = 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW';
    const changed = await context.request.put(origin + '/api/tournament', { data: { ...before, participants } });
    assert.equal(changed.status(), 200);
    await patch('/api/matches/r1-m1', { state: 'LIVE', scoreA: 3, scoreB: 2 });
    await overlay.setViewportSize({ width: 1920, height: 1080 });
    await overlay.waitForFunction(() => document.getElementById('blue-name').dataset.originalName.startsWith('LOS GUERREROS'));
    await overlay.evaluate(() => document.fonts.ready);
    const long = await metrics(overlay);
    await overlay.screenshot({ path: path.join(dir, 'default-long-1920.png'), clip: { x: 0, y: 0, width: 1920, height: 170 }, omitBackground: true });
    assert(long.names.every(n => n.fits && n.centered && n.size >= 22));
    await overlay.setViewportSize({ width: 865, height: 200 });
    await overlay.screenshot({ path: path.join(dir, 'default-long-865.png'), omitBackground: true });
    for (const font of ['barlow', 'impact', 'arial']) {
      await patch('/api/streaming', { fontFamily: font });
      await overlay.waitForFunction(font => document.getElementById('scoreboard').style.getPropertyValue('--name-font').toLowerCase().includes(font === 'arial' ? 'arial' : font), font);
      await overlay.evaluate(() => document.fonts.ready);
      assert((await metrics(overlay)).names.every(n => n.fits));
    }
    await patch('/api/matches/r1-m3', { state: 'LIVE' });
    await panel.locator('#match:not([disabled])').waitFor();
    await panel.locator('#match').selectOption('r1-m3');
    await panel.locator('#swapped').setChecked(true);
    await panel.locator('[data-design="nameSize"]').fill('52');
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    assert.equal(await panel.locator('#match').inputValue(), 'r1-m3', 'autosave must preserve the pending match choice');
    assert.equal(await panel.locator('#swapped').isChecked(), true);
    await panel.getByRole('button', { name: 'Guardar Streaming', exact: true }).click();
    await panel.locator('#message').filter({ hasText: 'Streaming guardado' }).waitFor();
    await panel.locator('#reset-design').click();
    await panel.locator('#design-status').filter({ hasText: 'Diseño guardado y sincronizado' }).waitFor();
    const selection = await (await context.request.get(origin + '/api/streaming')).json();
    assert.equal(selection.settings.selectedMatchId, 'r1-m3');
    assert.equal(selection.settings.swapped, true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS: live preview, all controls, autosave/reload, OBS, reset, short/long names, all fonts, unchanged brackets', short, long, browserErrors: errors }, null, 2));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
