# Native widget & Watch stubs (post-prebuild)

After `npx expo prebuild` in `artifacts/torgima-mobile`:

## iOS WidgetKit

1. Add Widget Extension target in Xcode.
2. Read shared `UserDefaults(suiteName: "group.com.tornicles.torgima")` keys:
   - `widget_today_task_title`
   - `widget_streak_execution`
   - `widget_level`
3. `QuickFeedbackIntent` calls `POST /api/mobile/quick-feedback` via app group deep link.

## Android AppWidget

1. Add `TorgimaWidgetProvider` in `android/app/src/main/`.
2. Layout: task title, streak, "Mark done" button → `QuickFeedbackActivity`.
3. Refresh via `WorkManager` every 15 minutes calling widget snapshot API.

## watchOS

1. Add watch target; use `WCSession` to receive `todayTask` / `streak` from phone app.
2. Three buttons: Completed / Partial / Failed → message to phone → batch sync.

The React layer pushes snapshots via `pushWidgetSnapshotToNative()` once a native module is linked.
