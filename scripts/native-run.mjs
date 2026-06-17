#!/usr/bin/env node
/**
 * Natywna aplikacja na telefonie — bez Expo Go, bez EAS (lokalny build).
 *
 * Android (Linux): telefon przez USB → npm run native:android
 * iPhone: tylko na Macu z Xcode → npm run native:ios
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2] ?? 'help';

function run(cmd, args, opts = {}) {
  console.log(`\n→ ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function printHelp() {
  console.log(`
Biker Log — natywna aplikacja (bez Expo Go, bez chmury EAS)

  npm run native:android   Android przez USB (działa na Linuxie)
  npm run native:ios       iPhone — tylko na Macu + Xcode

Android — przed pierwszym uruchomieniem:
  1. Włącz „Opcje programisty” → „Debugowanie USB” na telefonie
  2. Podłącz kablem USB
  3. adb devices  (musi pokazać telefon)
  4. npm run native:android

iPhone na Linuxie: nie da się zbudować lokalnie — potrzebujesz Maca z Xcode
  albo build w chmurze (npm run app:ios).

Projekt nadal używa Expo jako silnika — to normalne. Nie używasz aplikacji „Expo Go”.
`);
}

if (platform === 'help' || platform === '-h') {
  printHelp();
  process.exit(0);
}

if (platform === 'android') {
  if (!existsSync(join(root, 'android'))) {
    run('npx', ['expo', 'prebuild', '--platform', 'android']);
  }
  run('npx', ['expo', 'run:android', '--device']);
  console.log('\n✅ Natywna aplikacja powinna być na telefonie Android.\n');
  process.exit(0);
}

if (platform === 'ios') {
  if (process.platform !== 'darwin') {
    console.error(`
❌ iPhone nie zbudujesz na Linuxie.

Opcje:
  • Mac + Xcode: npm run native:ios
  • Chmura Expo (EAS): npm run app:ios  (+ Apple Developer ~99 USD/rok)
`);
    process.exit(1);
  }
  if (!existsSync(join(root, 'ios'))) {
    run('npx', ['expo', 'prebuild', '--platform', 'ios']);
  }
  run('npx', ['expo', 'run:ios', '--device']);
  console.log('\n✅ Natywna aplikacja powinna być na iPhone.\n');
  process.exit(0);
}

printHelp();
process.exit(1);
