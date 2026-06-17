# Biker Log — iOS, EAS, AltStore, GPS (audyt projektu)

Dokument dla Claude / agentów AI: pełny kontekst buildu iOS bez płatnego Apple Developer, plus stan GPS w tle.

**Projekt:** `/home/bartek/projects/bike-record/mobile`  
**Ostatnia weryfikacja:** 2026-06-16

---

## 1. Tech stack (dokładnie)

| Warstwa | Wybór |
|---|---|
| Framework | **React Native 0.85.3** + **Expo SDK ~56.0.11** (managed workflow, **NIE Flutter**) |
| Routing | **expo-router ~56** (Stack + tabs, file-based) |
| Język | TypeScript |
| Storage | **expo-sqlite** (`bikerecord.db`, offline, bez chmury) |
| Lokalizacja | **expo-location** + **expo-task-manager** |
| Mapy | **react-native-maps** (Apple Maps na iOS) |
| Powiadomienia | **expo-notifications** (lokalne) |
| Inne | expo-file-system, expo-sharing, expo-document-picker, react-native-reanimated |
| Build | **EAS CLI** (`eas.json`, skrypty w `package.json`) |

**Nie używane:** Flutter, react-native-background-geolocation, Redux, Firebase.

---

## 2. Gotowość iOS

### Pliki konfiguracyjne

| Plik | Status |
|---|---|
| `app.json` | ✅ skonfigurowany |
| `eas.json` | ✅ profile `preview` (internal) + `production` |

### Folder natywny

| Platforma | Folder | Tryb |
|---|---|---|
| iOS | **brak `ios/`** | Managed Expo — generowany przy prebuild / EAS Build |
| Android | **`android/` istnieje** | lokalny prebuild wykonany |

### Bundle identifier

**`com.bikerlog.app`** (`ios.bundleIdentifier`, `android.package`, `buildNumber: "1"`)

### Uprawnienia iOS (z `app.json`)

- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes: ["location"]`
- Plugin `expo-location` z `isIosBackgroundLocationEnabled: true`

Brak: camera, microphone, Bluetooth — nie są potrzebne.

### Brakuje przed pierwszym buildem EAS

- **`extra.eas.projectId`** w `app.json` — dodać przez `npx eas-cli init`
- **Logowanie EAS** — `npx eas-cli login`
- **Rejestracja UDID iPhone** — `npx eas-cli device:create`
- **Credentials Apple** — konfiguracja przy pierwszym buildzie iOS (Apple ID + hasło aplikacji przy 2FA)

---

## 3. GPS w tle

### Biblioteka

**expo-location** + **expo-task-manager** (nie react-native-background-geolocation).

### Dwa osobne mechanizmy

| Funkcja | Plik | API | Działa w tle? |
|---|---|---|---|
| Auto-start jazd (ustawienie „background”) | `lib/background-location.ts`, `lib/background-ride-task.ts` | `startLocationUpdatesAsync` + TaskManager | ✅ tak — poprawnie skonfigurowane |
| Ręczne nagrywanie aktywnej jazdy | `lib/ride-tracker.ts` | `watchPositionAsync` | ❌ nie — tylko foreground; przy zablokowanym iPhonie niewiarygodne |
| Auto-start w aplikacji otwartej | `lib/auto-ride-detector.ts` | `watchPositionAsync` | tylko gdy app na pierwszym planie |

### Konfiguracja auto-start w tle

- `distanceInterval: 25` m
- próg prędkości: **≥ 25 km/h przez 20 s** (`background-ride-task.ts`, `auto-ride-detector.ts`)
- wymaga **Always** location permission

### Krótkie trasy ~700 m

| Scenariusz | Niezawodność |
|---|---|
| Ręczny start, app otwarta / ekran włączony | ✅ tak (10 m / 5 s w `ride-tracker.ts`) |
| Ręczny start, telefon zablokowany / app w tle | ❌ niewiarygodne |
| Auto-start w tle włączony | ❌ krótkie trasy nie spełnią progu 25 km/h × 20 s |

### Zalecana poprawka (nie zrobiona)

Podczas **aktywnej jazdy** na iOS użyć `startLocationUpdatesAsync` (osobny task) zamiast samego `watchPositionAsync`, żeby trasa zapisywała się przy zablokowanym ekranie.

---

## 4. IPA dla AltStore (darmowe Apple ID, bez płatnego Developer)

### Co jest OK

- Bundle ID, stringi lokalizacji, UIBackgroundModes
- Skrypty: `npm run app:ios` → `scripts/build-native.mjs`

### Blokery / uwagi

1. **`eas init`** — brak `projectId`
2. **`preview` ma `"distribution": "internal"`** — ad hoc zwykle wymaga płatnego Apple Developer ($99/rok). Przy **darmowym Apple ID** EAS używa **development signing** — działa do sideloadu, ale app **wygasa po ~7 dniach**
3. **UDID iPhone** musi być zarejestrowany przed buildem
4. **`scripts/build-native.mjs`** błędnie sugeruje, że iPhone wymaga płatnego konta — **AltStore + darmowe Apple ID działa** (z limitem 7 dni)
5. **`expo-sharing` w `plugins`** — nietypowe; jeśli prebuild iOS padnie, usunąć z listy pluginów (to API runtime, nie plugin natywny)
6. **Aktywna jazda w tle** — problem funkcjonalny, nie blokuje buildu IPA

### Limity AltStore + darmowe Apple ID

- Odświeżanie co **~7 dni** (AltServer na Windows, ta sama sieć Wi‑Fi)
- Max **~3 sideloadowane appki** na darmowe Apple ID
- AltStore **re-signuje** IPA Twoim Apple ID

---

## 5. Kroki: build IPA (Linux) + instalacja AltStore (Windows)

### A) EAS Build na Linuxie

```bash
cd mobile
npm install
npx eas-cli login
npx eas-cli init                    # zapisze projectId do app.json
npx eas-cli device:create           # rejestracja UDID iPhone (link na telefonie)
npx eas-cli build --platform ios --profile preview
# lub: npm run app:ios
```

Przy pierwszym buildzie iOS: Apple ID + app-specific password ([appleid.apple.com](https://appleid.apple.com)).

Pobierz `.ipa` z [expo.dev](https://expo.dev) → projekt → Builds (~15–25 min).

**Jeśli build padnie na credentials:** spróbuj profilu bez `"distribution": "internal"`:

```json
"preview-free": {
  "ios": { "simulator": false }
}
```

```bash
npx eas-cli build --platform ios --profile preview-free
```

### B) AltStore na iPhone + AltServer na Windows

**Setup (jednorazowo):**

1. iTunes + iCloud for Windows (Apple)
2. AltServer z [altstore.io](https://altstore.io)
3. iPhone USB → AltServer tray → Install AltStore → [iPhone]
4. iPhone: Settings → General → VPN & Device Management → zaufaj Apple ID

**Instalacja IPA:**

1. Skopiuj `.ipa` na PC
2. Ta sama sieć Wi‑Fi co iPhone
3. AltServer tray → **Install .IPA…** → wybierz plik
4. Na iPhonie: nadaj **Location → Always** jeśli chcesz auto-start w tle

**Utrzymanie:**

- AltStore → My Apps → **Refresh All** co 7 dni (AltServer włączony na Windows)

---

## 6. Skrypty npm (mobile)

| Skrypt | Opis |
|---|---|
| `npm run app:android` | EAS cloud → APK (preview) |
| `npm run app:ios` | EAS cloud → IPA (preview) |
| `npm run native:android` | lokalny build + USB (Linux OK) |
| `npm run native:ios` | wymaga Maca |
| `npm run iphone:web` | dev w Safari (słabe GPS) |

---

## 7. Android (stan)

- Debug APK zbudowany lokalnie: `android/app/build/outputs/apk/debug/app-debug.apk`
- Gradle wrapper: **8.14.3** (nie 9.x)
- W momencie buildu brak podłączonego telefonu przez `adb`

---

## 8. Kluczowe pliki

| Plik | Rola |
|---|---|
| `app.json` | bundle ID, uprawnienia iOS, pluginy |
| `eas.json` | profile buildów |
| `lib/ride-tracker.ts` | aktywna jazda (watchPositionAsync) |
| `lib/background-location.ts` | włączanie auto-start w tle |
| `lib/background-ride-task.ts` | task TaskManager, próg 25 km/h |
| `lib/auto-ride-detector.ts` | auto-start gdy app na pierwszym planie |
| `scripts/build-native.mjs` | wrapper EAS build |

---

## 9. Checklist przed buildem iOS

- [ ] `npx eas-cli login`
- [ ] `npx eas-cli init`
- [ ] `npx eas-cli device:create`
- [ ] Apple ID + app-specific password gotowe
- [ ] Akceptacja 7-dniowego odświeżania AltStore
- [ ] Krótkie trasy: ręczny start z app na pierwszym planie
