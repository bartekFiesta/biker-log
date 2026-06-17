@AGENTS.md

## Kontekst projektu Biker Log

Aplikacja mobilna (React Native + Expo SDK 56) do logowania jazd motocyklem. Dane lokalnie w SQLite, offline.

**Przed pracą nad iOS / EAS / AltStore / GPS w tle — przeczytaj:**

→ **`IOS-ALTSTORE-GUIDE.md`** — pełny audyt: tech stack, uprawnienia iOS, GPS, blokery buildu, kroki EAS + AltStore.

**Inne docs:**

- `README.md` — uruchomienie, funkcje
- `ROADMAP.md` — plan rozwoju

**Ważne fakty (skrót):**

- Bundle ID: `com.bikerlog.app`
- Brak folderu `ios/` (managed Expo)
- Brak `extra.eas.projectId` — wymaga `eas init`
- Aktywna jazda używa `watchPositionAsync` (słabe w tle); auto-start w tle używa `startLocationUpdatesAsync` (OK, ale próg 25 km/h × 20 s)
