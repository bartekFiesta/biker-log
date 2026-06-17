#!/usr/bin/env node
/**
 * npm run iphone — otwarcie Biker Log na iPhone (Expo Go SDK 56)
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
const EXPO_GO_INSTALL = 'https://expo.dev/go?sdkVersion=56&platform=ios&device=true';

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

function buildPhonePage({ directUrl, expUrl }) {
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
      display: block; width: 100%; margin: 20px 0 12px; padding: 18px 20px;
      background: #ff6b35; color: #fff; text-decoration: none; text-align: center;
      border-radius: 14px; font-size: 20px; font-weight: 700;
    }
    .warn {
      background: #2a1a10; border: 1px solid #ff6b35; border-radius: 12px;
      padding: 14px; margin: 16px 0; font-size: 14px; color: #ffb899; line-height: 1.5;
    }
    .steps { text-align: left; color: #ccc; font-size: 14px; line-height: 1.6; margin: 16px 0; }
    .steps li { margin-bottom: 8px; }
    .hint { font-size: 13px; color: #666; line-height: 1.5; text-align: center; }
    .mono { font-size: 11px; word-break: break-all; color: #888; margin-top: 12px; text-align: center; }
    a { color: #ff6b35; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <h1>Biker Log</h1>
  <div class="warn">
    Potrzebujesz <strong>Expo Go SDK 56</strong> — zwykły App Store (SDK 54) <strong>nie zadziała</strong>.
    <br /><a href="${EXPO_GO_INSTALL}">Zainstaluj Expo Go SDK 56</a>
  </div>
  <a class="btn" href="${directUrl}">Otwórz Biker Log</a>
  <ol class="steps">
    <li>Stuknij pomarańczowy przycisk</li>
    <li>Stuknij <strong>Otwórz</strong> gdy Safari zapyta o Expo Go</li>
    <li>Albo w Expo Go → Enter URL → <code>${expUrl}</code></li>
  </ol>
  <p class="hint">Bez Expo Go SDK 56 aplikacja się nie uruchomi.</p>
</body>
</html>`;
}

function buildComputerPage({ phoneUrl, directUrl, expUrl }) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(directUrl)}`;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Biker Log — iPhone</title>
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
    p { color: #aaa; line-height: 1.5; margin: 0 0 12px; font-size: 15px; }
    img { width: 360px; max-width: 100%; border-radius: 16px; background: #fff; padding: 8px; }
    .warn {
      background: #2a1a10; border: 1px solid #ff6b35; border-radius: 12px;
      padding: 14px; margin: 12px 0; font-size: 14px; color: #ffb899; line-height: 1.5; text-align: left;
    }
    .url { font-size: 18px; color: #ff6b35; font-weight: 700; margin: 12px 0; word-break: break-all; }
    .steps { text-align: left; font-size: 14px; color: #ccc; line-height: 1.6; margin: 16px 0; }
    .steps li { margin-bottom: 6px; }
    .hint { font-size: 13px; color: #666; margin-top: 16px; line-height: 1.5; }
    a { color: #ff6b35; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Biker Log</h1>
    <div class="warn">
      <strong>Wymagane:</strong> Expo Go SDK 56 (nie App Store).<br />
      <a href="${EXPO_GO_INSTALL}">expo.dev/go → SDK 56 → iOS</a>
    </div>
    <ol class="steps">
      <li>Zainstaluj Expo Go SDK 56 (link powyżej)</li>
      <li>Na iPhone: <strong>zeskanuj QR aparatem</strong> → Safari → Otwórz</li>
      <li>Albo Safari → <span class="url">${phoneUrl}</span></li>
    </ol>
    <img src="${qr}" alt="QR Biker Log" width="360" height="360" />
    <p class="hint">
      Ręcznie w Expo Go: <code style="color:#888">${expUrl}</code>
    </p>
  </div>
</body>
</html>`;
}

async function waitForMetro(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:8081/status');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error('Serwer nie wystartował.');
}

async function waitForTunnel(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/tunnels');
      const data = await res.json();
      const tunnel = data.tunnels?.find((t) => t.proto === 'https' && t.public_url);
      if (tunnel) {
        const base = tunnel.public_url.replace(/\/$/, '');
        const host = new URL(base).hostname;
        return {
          directUrl: `${base}/_expo/link?choice=expo-go&platform=ios`,
          expUrl: `exp://${host}`,
        };
      }
    } catch {}

    try {
      const res = await fetch('http://127.0.0.1:8081/', {
        headers: { 'expo-platform': 'ios' },
      });
      const manifest = await res.json();
      const host =
        manifest.extra?.expoClient?.hostUri ??
        manifest.extra?.expoGo?.debuggerHost;
      if (host && host.includes('.exp.direct')) {
        const cleanHost = host.replace(/^https?:\/\//, '');
        const base = `https://${cleanHost}`;
        return {
          directUrl: `${base}/_expo/link?choice=expo-go&platform=ios`,
          expUrl: `exp://${cleanHost}`,
        };
      }
    } catch {}

    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('Tunnel nie wystartował.');
}

console.log('\n🚀 Biker Log — uruchamiam...\n');

try {
  execSync('fuser -k 8081/tcp 8888/tcp 2>/dev/null', { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
} catch {}

const expo = spawn('npx', ['expo', 'start', '--tunnel'], {
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
  const urls = await waitForTunnel();
  const lanIp = getLanIp();
  const phoneUrl = `http://${lanIp}:${PHONE_PORT}`;
  const phoneHtml = buildPhonePage(urls);
  const computerHtml = buildComputerPage({ phoneUrl, ...urls });

  writeFileSync(htmlPath, computerHtml, 'utf8');

  const phoneServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(phoneHtml);
  });
  await new Promise((resolve, reject) => {
    phoneServer.once('error', reject);
    phoneServer.listen(PHONE_PORT, '0.0.0.0', resolve);
  });

  console.log(`\n✅ Gotowe!\n`);
  console.log(`   1. Zainstaluj Expo Go SDK 56:`);
  console.log(`      ${EXPO_GO_INSTALL}\n`);
  console.log(`   2. iPhone — zeskanuj QR z otwartej strony (aparat → Safari → Otwórz)`);
  console.log(`      albo Safari: ${phoneUrl}\n`);
  console.log(`   3. Ręcznie w Expo Go: ${urls.expUrl}\n`);
} catch (error) {
  console.error('\n❌', error instanceof Error ? error.message : error);
  expo.kill();
  process.exit(1);
}
