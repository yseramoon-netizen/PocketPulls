/** Runs the real app with browser-intercepted fictional accounts; never a live Supabase project. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reports = path.join(root, 'docs/verification');
fs.mkdirSync(reports, { recursive: true });
// Next watches the project tree. Writing its log there can itself trigger a refresh.
const temporaryReports = fs.mkdtempSync(path.join(os.tmpdir(), 'ancient-pulls-browser-'));
const port = Number(process.env.ANCIENT_PULLS_QA_PORT || 3100), origin = `http://localhost:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: root, env: { ...process.env, ANCIENT_PULLS_BUILD_DIR: '.next-qa', NEXT_PUBLIC_SUPABASE_URL: 'https://ancient-preview.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'preview-public-key', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
const log = fs.createWriteStream(path.join(temporaryReports, 'browser-server.log')); server.stdout.pipe(log); server.stderr.pipe(log);
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw Error('The test server could not start. See docs/verification/browser-server.log.');
    try { const r = await fetch(`${origin}/sign-in`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw Error('The test server did not become ready.');
  const scripts = process.argv.includes('--recharge-only') ? ['recharge.mjs'] : process.argv.includes('--edges-only') ? ['edges.mjs'] : process.argv.includes('--reveal-only') ? ['reveal.mjs'] : ['checks.mjs', 'edges.mjs', 'recharge.mjs', 'reveal.mjs'];
  for (const script of scripts) {
    const child = spawn(process.execPath, [path.join(root, 'scripts/browser', script)], { cwd: root, env: { ...process.env, ANCIENT_PULLS_QA_ORIGIN: origin, ANCIENT_PULLS_QA_REPORTS: temporaryReports }, stdio: 'inherit' });
    const code = await new Promise(resolve => child.on('exit', resolve));
    if (code !== 0) { process.exitCode = code || 1; break; }
  }
} finally {
  if (server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
  log.end();
  fs.cpSync(temporaryReports, reports, { recursive: true });
  fs.rmSync(temporaryReports, { recursive: true, force: true });
}
