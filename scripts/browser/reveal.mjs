import { session } from './session.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reports = process.env.ANCIENT_PULLS_QA_REPORTS || path.join(root, 'docs/verification');
const app = await session({ balance: 2 });
try {
 const p = app.page;
 await p.getByRole('button', { name: 'Call Astra', exact: true }).click();
 await p.getByTestId('astra-staff').waitFor(); await p.waitForTimeout(800);
 const checks = [];
 for (const method of ['button', 'Escape']) {
  await p.getByTestId('astra-staff').focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  await p.getByRole('button', { name: 'Reveal card', exact: false }).waitFor();
  if (method === 'button') await p.getByRole('button', { name: 'Reveal card', exact: false }).click();
  else await p.keyboard.press('Escape');
  await p.getByTestId('wish-result').waitFor();
  const stages = await p.evaluate(async () => {
   const stages = [];
   for (let i = 0; i < 32; i++) { await new Promise(resolve => setTimeout(resolve, 100)); stages.push(document.querySelector('.as-wish-moment')?.getAttribute('data-stage')); }
   return stages;
  });
  assert.ok(stages.every(stage => stage === 'card'), 'A revealed card must never return to the cinematic');
  await p.getByRole('button', { name: 'Place in my constellation', exact: false }).click();
  checks.push(method + ' reveal cancels pending cinematic timers and keeps the card visible');
 }
 assert.equal(app.state.calls.length, 2); assert.equal(app.state.balance, 0); assert.deepEqual(app.state.errors, []);
 fs.writeFileSync(path.join(reports, 'browser-reveal-results.json'), JSON.stringify({ passed: checks.length, checks }, null, 2));
 checks.forEach(check => console.log('PASS ' + check));
} finally { await app.browser.close(); }
