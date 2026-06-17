# Biker Log — mobile app

iPhone and Android app for logging motorcycle rides, refuelings, fuel consumption, and service records. Data is stored **locally** on your phone (SQLite, offline).

## Features

- **Dashboard** — consumption, fuel level, service reminders, Find My Bike, active ride
- **Rides** — GPS routes, pause/resume, trip labels, tolls, map preview, speed stats
- **Fuel** — full/partial refueling, edit entries, auto price calculation
- **Stats** — week / month / year aggregates + monthly charts
- **Service** — oil, brake pads, insurance, road tax + reminder status
- **Settings** — units (km/mi, L/gal), currency, reminders, notifications, auto-start, CSV import/export
- **Multiple motorcycles** — switch bikes in Settings → Manage motorcycles

## Requirements

- Node.js 18+
- **Expo Go** on your phone (for quick testing; background GPS needs a dev build)
- Google Maps API key for Android maps (see below)

## Run

```bash
cd mobile
npm install
npm start
```

Scan the QR code with Expo Go.

## Getting started

On **first launch** complete onboarding: motorcycle name, **tank capacity**, optional odometer baseline, and currency.

1. **Settings** → tank size, units, currency, service reminder intervals
2. **Fuel** → add full-tank refuelings with odometer (need 2 for consumption)
3. **Rides** → Start ride, or enable **Auto-start rides** (foreground or background)
4. Use **Pause** at rest stops — distance only counts while recording
5. Tap fuel/service entries to **edit**; long-press to delete

## Service reminders

Configure in **Settings → Service reminders** (defaults include oil, brake pads, insurance, road tax). Dashboard shows **due soon** / **overdue**. Enable **Notifications** in Settings for local push alerts.

## Auto-start rides

- **Foreground** — speed above 25 km/h for 20 seconds while app is open
- **Background** — same logic with background location (requires dev/production build and permission)

## Find My Bike

After each completed ride, the last GPS point is saved. Dashboard shows **Find my bike** — opens Maps at the parked location.

## Data import / export

- **Export CSV** — rides, fuel, service (share sheet)
- **Import CSV** — re-import fuel and service sections from a previous export

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for remaining ideas vs Ride Log.

## Maps (Android)

Add Google Maps API key in `app.json` under `android.config.googleMaps.apiKey`.

## Out of scope (for now)

- Cloud sync
- Community route sharing
- iOS widgets / Live Activities
