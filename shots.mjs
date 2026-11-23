// Playwright driver for Ember Duel: real play-test + real screenshots.
// Serves game/ on :8080 (node serve.ts), then:
//  1. plays a real duel: start -> play a card -> end turn -> AI plays -> state changes, no console errors
//  2. captures the 4 staged shots (?shot=start|play|win|loss) as JPEGs into screenshots/
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url).pathname;
const OUT = `${ROOT}screenshots`;
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: ROOT, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

// ---- real play-test: start the duel, play a card, end the turn ----
await page.goto('http://localhost:8080/?seed=42', { waitUntil: 'networkidle' });
await page.click('#startBtn');
await page.waitForTimeout(400);
const before = await page.evaluate(() => ({
  turn: document.getElementById('turnNum').textContent,
  hand: document.querySelectorAll('#yourHand .card').length,
  mana: document.getElementById('youMana').textContent.length,
}));
// Play the first affordable card by clicking it.
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#yourHand .card')];
  const playable = cards.find((c) => !c.classList.contains('unplayable'));
  if (playable) playable.click();
});
await page.waitForTimeout(300);
const afterPlay = await page.evaluate(() => ({
  hand: document.querySelectorAll('#yourHand .card').length,
  log: document.getElementById('log').textContent,
  lastPlay: document.getElementById('lastPlay').textContent,
}));
await page.click('#endTurnBtn');
await page.waitForTimeout(3500); // let Rook think and play
const afterAi = await page.evaluate(() => ({
  turn: document.getElementById('turnNum').textContent,
  yourTurn: !document.getElementById('endTurnBtn').disabled,
  log: document.getElementById('log').textContent,
  foeHand: document.querySelectorAll('#foeHand .card').length,
}));
// Two more full rounds: Rook must actually play cards on later turns.
for (let round = 0; round < 2; round += 1) {
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#yourHand .card')];
    const playable = cards.find((c) => !c.classList.contains('unplayable'));
    if (playable) playable.click();
  });
  await page.waitForTimeout(300);
  await page.click('#endTurnBtn');
  await page.waitForTimeout(6000);
}
const later = await page.evaluate(() => ({
  turn: document.getElementById('turnNum').textContent,
  yourTurn: !document.getElementById('endTurnBtn').disabled,
  log: document.getElementById('log').textContent,
  youLife: document.getElementById('youLifeText').textContent,
  foeLife: document.getElementById('foeLifeText').textContent,
}));
console.log(JSON.stringify({ before, afterPlay, afterAi, later, errors }, null, 2));
if (errors.length) throw new Error(`play-test had errors: ${errors.join(' | ')}`);
if (afterPlay.hand !== before.hand - 1) throw new Error(`card was not played: hand ${before.hand} -> ${afterPlay.hand}`);
if (afterAi.turn !== '2') throw new Error(`turn did not advance to 2: ${afterAi.turn}`);
if (!afterAi.yourTurn) throw new Error('turn did not return to the player');
if (later.turn !== '4') throw new Error(`turn did not reach 4: ${later.turn}`);
if (!/Rook (hurls|plays|raises|kindles)/.test(later.log)) throw new Error('Rook never played a card in 3 rounds');
console.log('PLAY-TEST PASSED: start, play card, AI turn, turn 4, Rook plays cards, no errors.');

// ---- staged screenshots (deterministic, seeded) ----
const shots = [
  { name: '1-start.jpg', query: '?shot=start&seed=7' },
  { name: '2-play.jpg', query: '?shot=play&seed=7' },
  { name: '3-win.jpg', query: '?shot=win&seed=7' },
  { name: '4-loss.jpg', query: '?shot=loss&seed=7' },
];
for (const s of shots) {
  await page.goto(`http://localhost:8080/${s.query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shotReady === true, { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}`, type: 'jpeg', quality: 88 });
  console.log(`shot ${s.name} saved`);
}

await browser.close();
server.kill();
console.log('ALL DONE');
