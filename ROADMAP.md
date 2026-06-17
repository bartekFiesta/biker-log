# Biker Log — roadmap (vs Ride Log)

## Done

| Feature | Status |
|---------|--------|
| Service reminders (km + days) | Done |
| Push notifications for reminders | Done — Settings → Notifications |
| Ride statistics (week / month / year) | Done — Stats tab |
| Monthly charts (distance, fuel, spend) | Done — Stats tab |
| CSV export / import | Done — Settings |
| GPS speed (avg / max) | Done — ride details |
| Auto-start rides (foreground) | Done — Settings |
| Auto-start rides (background) | Done — dev build + background permission |
| Pause / resume rides | Done |
| Multiple motorcycles | Done — Settings → Manage motorcycles |
| Units (km/mi, L/gal, MPG) | Done — Settings |
| Edit fuel / service / ride entries | Done — tap entry to edit |
| Trip labels + tolls | Done — stop ride / edit ride |
| Find My Bike (last park location) | Done — Dashboard |
| Insurance / road tax service types | Done |
| Onboarding (name, tank, odometer, currency) | Done |

## Next (optional polish)

| Feature | Priority | Notes |
|---------|----------|-------|
| PDF export | Low | CSV covers most cases |
| Richer charts library | Low | Current bar charts are lightweight |
| Per-bike settings (currency/units) | Low | Global settings today |
| Photo attachments for service | Low | |

## Later (phase 3)

- Cloud backup / sync
- Route sharing / community
- iOS widgets / Live Activities
- Wearable / CarPlay integration

## Comparison snapshot

Biker Log now covers most **core** Ride Log features locally: rides, fuel, service, consumption, pause, auto-start (including background in dev builds), reminders with notifications, multi-bike, stats, charts, import/export, Find My Bike, trip metadata.

Main gaps vs Ride Log: **cloud sync**, **community routes**, **native iOS widgets**, **photo attachments**.
