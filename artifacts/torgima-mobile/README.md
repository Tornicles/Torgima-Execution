# Torgima Mobile (PROMPT 6)

Expo React Native app — offline-first execution companion for Torgima.

## Setup

```bash
cd artifacts/torgima-mobile
pnpm install
```

Add placeholder assets (or run `npx expo install` which may generate defaults):

- `assets/icon.png` (1024×1024)
- `assets/splash.png`
- `assets/adaptive-icon.png`

## Run

```bash
# Point at local API
set EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000/api
pnpm start
```

Auth uses `POST /api/mobile/auth/verify` (returns Bearer session token for mobile).

## Features

- Bottom tabs: Dashboard, Task, Chat, Principles, Profile
- Zustand state + SQLite offline queue
- Batch sync via `POST /api/mobile/sync/batch`
- Push token registration via Expo Notifications
- Widget data: `GET /api/mobile/widget-data`
- Health / wearable stubs (native HealthKit/Google Fit after prebuild)

## Native widgets & Watch

Run `npx expo prebuild` then add:

- **iOS**: WidgetKit extension + WatchConnectivity (see `docs/native-widgets.md` in repo root scripts)
- **Android**: `AppWidgetProvider` in `android/` module

Shared widget snapshot is written by `src/services/widgetService.ts`.

## Backend migration

```powershell
psql $env:DATABASE_URL -f scripts/migrations/manual-20260521-mobile-complete.sql
```

Feature flag: `mobile_app_enabled` (on by default in seed).
