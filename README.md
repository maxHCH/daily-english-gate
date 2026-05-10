# Daily English Gate

**[繁體中文](README.zh-TW.md)**

A Chrome extension that opens ChatGPT automatically on your first daily Chrome focus, tracks your active time, and helps you build a daily English conversation habit.

## Features

- Opens ChatGPT automatically the first time you switch to Chrome each day
- Tracks **actual active time** on the ChatGPT tab — pauses when you switch away
- Marks the day complete after 10 cumulative minutes
- Toolbar badge shows live status:
  - 🔴 `!` — not started today
  - 🔵 `Xm` — in progress, minutes remaining
  - 🟢 `N` — completed, showing current streak
- Push notification at 8 PM if you haven't finished yet
- Popup shows a progress ring, streak count, and weekly completions

## Installation

1. Clone or download this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the repo folder

## How It Works

```
First Chrome focus of the day
  └─ ChatGPT tab opens automatically

ChatGPT tab is in the foreground
  └─ Active time accumulates every minute (heartbeat alarm)
  └─ Switch to another tab → timer pauses

10 minutes accumulated
  └─ Session marked complete
  └─ Streak and weekly stats updated
  └─ Completion notification sent

8 PM (if not yet complete)
  └─ Reminder notification pushed
```

**Why active time instead of a fixed timer?**

A fixed 10-minute timer completes as long as the tab is open — you could ignore it entirely.
Active time tracking requires you to actually stay on the ChatGPT tab.
Works with both text and voice mode since it doesn't depend on detecting input.

## Popup States

| State | Display |
|---|---|
| Not started | Empty ring + **Start Now** button |
| In progress (ChatGPT active) | Blue ring filling + `ChatGPT in use ▶` |
| In progress (ChatGPT in background) | Ring paused + yellow `Switch back to ChatGPT to continue` |
| Completed | Full green ring + `✓ Done for today!` |

## Storage

All data is stored locally via `chrome.storage.local`. Nothing is sent to any server.

```jsonc
{
  "lastSessionDate": "2026-05-11",         // whether today's session was triggered
  "sessionCompleted": true,                // whether today is done
  "accumulatedActiveSecs": 600,            // total active seconds on ChatGPT tab
  "chatGptTabId": 42,                      // ID of the tracked tab
  "completedDays": { "2026-05-10": true }, // full completion history
  "streak": 3,                             // current consecutive-day streak
  "weeklyCount": 4                         // completions this week (Mon–today)
}
```

## Known Limitations

- **Cannot verify actual conversation**: active time only means the ChatGPT tab was in the foreground — OpenAI provides no public API for ChatGPT Web usage history.
- **Voice mode supported**: the timer is input-agnostic, so text and voice both count.
- **Streak requires daily completion**: if you don't hit 10 minutes on a given day, the streak resets.

## Tech

- Manifest V3
- Vanilla JavaScript — no backend, no external dependencies
- Service Worker + `chrome.alarms` (heartbeat survives SW suspension)

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save session records, streak, weekly stats |
| `tabs` | Open ChatGPT tab, track active tab |
| `alarms` | Per-minute heartbeat, evening reminder |
| `windows` | Detect window focus changes to pause/resume timer |
| `notifications` | Completion alert, evening reminder push |
