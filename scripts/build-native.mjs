#!/usr/bin/env node
/**
 * Natywna aplikacja Biker Log (bez Expo Go, bez PWA).
 *
 * Android APK — darmowa instalacja (pobierz plik .apk z expo.dev).
 * iPhone — wymaga Apple Developer (~99 USD/rok), potem TestFlight lub link z EAS.
 */
import { spawnSync } from 'node:child_process';

const platform = process.argv[2] ?? 'help';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function eas(args) {
  run('npx', ['eas-cli', ...args]);
}

function printHelp() {
  console.log(`
Biker Log — natywna aplikacja (bez Expo Go)

  npm run app:android   → APK na Android (bez opłat, instalujesz plik .apk)
  npm run app:ios       → iPhone (wymaga Apple Developer ~99 USD/rok)

Pierwszy raz:
  1. npx eas-cli login
  2. npx eas-cli init
  3. npm run app:android   (albo app:ios)

Po zbudowaniu: link do pobrania pojawi się na https://expo.dev
`);
}

if (platform === 'help' || platform === '-h' || platform === '--help') {
  printHelp();
  process.exit(0);
}

if (platform !== 'android' && platform !== 'ios') {
  console.error(`Nieznana platforma: ${platform}\n`);
  printHelp();
  process.exit(1);
}

console.log(`\n📦 Biker Log — build natywny (${platform})\n`);

const whoami = spawnSync('npx', ['eas-cli', 'whoami'], { encoding: 'utf8' });
if (whoami.status !== 0 || whoami.stdout?.includes('Not logged in')) {
  console.log('Zaloguj się do Expo (darmowe konto):\n');
  eas(['login']);
}

if (platform === 'android') {
  console.log('Buduję APK (Android, bez Google Play)...\n');
  eas(['build', '--platform', 'android', '--profile', 'preview']);
} else {
  console.log('Buduję IPA (iPhone)...\n');
  console.log('Potrzebujesz konta Apple Developer (~99 USD/rok).\n');
  eas(['build', '--platform', 'ios', '--profile', 'preview']);
}

console.log('\n✅ Gdy build skończy, pobierz aplikację z panelu: https://expo.dev\n');
