#!/usr/bin/env node
/**
 * npm run iphone — Biker Log w Safari na iPhone (bez Expo Go)
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'iphone.html');
const PHONE_PORT = 8888;
const METRO_PORT = 8081;

function getLanIp() {
  try {
    const routeIp = execSync("ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'", {
      encoding: 'utf8',
    }).trim();
    if (routeIp && /^\d+\.\d+\.\d+\.\d+$/.test(routeIp)) return routeIp;
  } catch {}

  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '127.0.0.1';
}

function buildPhonePage(appUrl) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Biker Log</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; padding: 24px 20px 40px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #121212; color: #fff;
    }
    h1 { margin: 0 0 8px; font-size: 26px; text-align: center; }
    p { color: #aaa; line-height: 1.5; font-size: 15px; text-align: center; }
    .btn {
      display: block; width: 100%; margin: 24px 0 16px; padding: 18px 20px;
      background: #ff6b35; color: #fff; text-decoration: none; text-align: center;
      border-radius: 14px; font-size: 20px; font-weight: 700;
    }
    .note {
      background: #1a1a1a; border-radius: 12px; padding: 14px; margin: 16px 0;
      font-size: 13px; color: #888; line-height: 1.5;
    }
    a { color: #ff6b35; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <h1>Biker Log</h1>
  <p>Bez Expo Go — wersja w Safari</p>
  <a class="btn" href="${appUrl}">Otwórz Biker Log</a>
  <div class="note">
    iPhone i komputer muszą być na <strong>tym samym Wi‑Fi</strong>.<br />
    Przy pierwszym uruchomieniu Safari poprosi o dostęp do lokalizacji (GPS).
  </div>
</body>
</html>`;
}

function buildComputerPage({ appUrl, phoneUrl }) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(phoneUrl)}`;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Biker Log — iPhone (Safari)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #121212; color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .card { max-width: 460px; width: 100%; text-align: center; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .badge {
      display: inline-block; background: #1e3a1e; color: #8fdf8f;
      padding: 6px 12px; border-radius: 999px; font-size: 13px; margin-bottom: 16px;
    }
    .url { font-size: 20px; color: #ff6b35; font-weight: 700; margin: 16px 0; word-break: break-all; }
    .steps { text-align: left; font-size: 14px; color: #ccc; line-height: 1.6; margin: 16px 0; }
    .steps li { margin-bottom: 6px; }
    img { width: 360px; max-width: 100%; border-radius: 16px; background: #fff; padding: 8px; }
    .hint { font-size: 13px; color: #666; margin-top: 16px; line-height: 1.5; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Biker Log</h1>
    <div class="badge">Bez Expo Go</div>
    <ol class="steps">
      <li>iPhone i komputer na <strong>tym samym Wi‑Fi</strong></li>
      <li>Na iPhone: Safari → wpisz adres lub zeskanuj QR aparatem</li>
      <li>Stuknij <strong>Otwórz Biker Log</strong></li>
    </ol>
    <p class="url">${phoneUrl}</p>
    <img src="${qr}" alt="QR" width="360" height="360" />
    <p class="hint">Bezpośredni link: ${appUrl}<br />Pełna apka iOS: <code>npm run build:ios</code></p>
  </div>
</body>
</html>`;
}

async function waitForMetro(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${METRO_PORT}/status`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error('Serwer nie wystartował.');
}

console.log('\n🚀 Biker Log — Safari (bez Expo Go)...\n');

try {
  execSync('fuser -k 8081/tcp 8888/tcp 2>/dev/null', { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
} catch {}

const expo = spawn('npx', ['expo', 'start', '--web', '--host', 'lan', '--port', String(METRO_PORT)], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

expo.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => {
  expo.kill('SIGINT');
  process.exit(0);
});

try {
  await waitForMetro();
  const lanIp = getLanIp();
  const appUrl = `http://${lanIp}:${METRO_PORT}`;
  const phoneUrl = `http://${lanIp}:${PHONE_PORT}`;
  const phoneHtml = buildPhonePage(appUrl);
  const computerHtml = buildComputerPage({ appUrl, phoneUrl });

  writeFileSync(htmlPath, computerHtml, 'utf8');

  const phoneServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(phoneHtml);
  });
  await new Promise((resolve, reject) => {
    phoneServer.once('error', reject);
    phoneServer.listen(PHONE_PORT, '0.0.0.0', resolve);
  });

  console.log(`\n✅ Gotowe — bez Expo Go!\n`);
  console.log(`   iPhone (Safari): ${phoneUrl}`);
  console.log(`   albo bezpośrednio: ${appUrl}\n`);
  console.log(`   Zeskanuj QR z otwartej strony aparatem iPhone.\n`);

  try {
    execSync(`xdg-open "${htmlPath}"`, { stdio: 'ignore' });
  } catch {
    try {
      execSync(`open "${htmlPath}"`, { stdio: 'ignore' });
    } catch {}
  }
} catch (error) {
  console.error('\n❌', error instanceof Error ? error.message : error);
  expo.kill();
  process.exit(1);
}
