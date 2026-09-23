# ⏳ Root (Running Out Of Time)

> A fast, modern, offline-first Material 3 time-tracking and productivity intelligence application built for **Android 9.0+ (API 28+) & Web**.

[![Download Root APK](https://img.shields.io/badge/Download-Root%20APK%20(Android%209%2B)-brightgreen?style=for-the-badge&logo=android)](https://github.com/ShreeyashKZ/Running-out-of-time/releases/download/v1.1.0/Root.apk)
[![Release v1.1.0](https://img.shields.io/github/v/release/ShreeyashKZ/Running-out-of-time?style=for-the-badge)](https://github.com/ShreeyashKZ/Running-out-of-time/releases/tag/v1.1.0)

---

## 📲 Direct APK Installation (On Your Phone)

To install **Root** directly on your Android phone (Android 9.0+):

1. **[Click here to download `Root.apk`](https://github.com/ShreeyashKZ/Running-out-of-time/releases/download/v1.1.0/Root.apk)** (or go to the [v1.1.0 Release page](https://github.com/ShreeyashKZ/Running-out-of-time/releases/tag/v1.1.0)).
2. Tap the downloaded file in your browser notifications or Files app.
3. If prompted by Android, enable **"Allow from this source"** for your browser / file manager.
4. Tap **Install** and you're all set!

---

## 🌟 Key Features

### 1. 📱 Vertical Phone Screen Optimized
- Responsive, fluid typography (`clamp`) ensuring digital timers and readouts never overflow or clip on narrow vertical phone screens.
- Thumb-reachable full-width touch actions for comfortable one-handed use on Android.
- Compact Top Bar with White Rabbit icon, short "Root" branding, and quick action buttons.

### 2. 📊 Daily Screen-Time Style Activity Breakdown
- Visual daily breakdown modeled after phone Screen Time / Digital Wellbeing.
- Daily hero readout showing total active time and percentage of the 24-hour day.
- Segmented, multi-colored usage bar illustrating proportional time spent across activities.
- Ranked list of activities with individual progress bars, exact duration, and percentage share.
- Date navigation (`< Today >`) to inspect any day's history.

### 3. ✅ Corner Tasks & To-Do List
- Corner icon button (`checklist`) with live pending task badge indicator.
- Fast checklist: type a task and press enter.
- Strikethrough checkmark toggle.
- One-tap **"Track"** button next to each task to immediately set it as the active session title in Root!

### 4. 🐰 White Rabbit Launcher & Adaptive Icon
- Native Android adaptive icon (`ic_launcher.xml` + high-density mipmap foregrounds) ensuring Android 9+ launchers always show the White Rabbit icon.

### 5. 🔓 Open, Interoperable Data Storage
- 100% offline data stored locally in standard open schemas.
- Universal JSON export and RFC 4180 CSV export for use in Excel, Google Sheets, Python, Pandas, or external time-tracking tools.
- Native Android Web Share API support to send data directly to Google Drive, WhatsApp, Files, Gmail, etc.

### 6. ⏱️ Drift-Free Device-Synced Clock
- Continuous master clock synchronized to device local time.
- Day depletion gauge showing how much of today remains.
- Multi-tag tagging system with flexible tag-as-title promotion.
- Weekly, Monthly, and All-Time leaderboards.
- **Continuous Real-Time Display**: Live HH:MM:SS ticker with millisecond precision.
- **Drift-Free Background Tracking**: Uses system timestamps (`Date.now() - startTime`). Whether you switch apps, close the tab, or your Android device enters Doze mode, returning hours later accurately records the exact elapsed duration.
- **Human-Readable Formats**: Automatically calculates and displays natural duration summaries such as `"3 hours 5 minutes"`.
- **Active Status Indicator**: Dynamic status pulsing aura and live browser tab titles.

### 2. 🏷️ Tag Memory & Intelligent Autocomplete
- **Activity Memory**: The app automatically remembers every activity you log.
- **Instant Autocomplete**: Type any character (e.g., `"a"`), and past activities like `"Attending class"` immediately appear in an interactive dropdown.
- **Multi-Tag System**: Attach tags like `#study`, `#college`, `#coding`, or `#fitness` to organize your sessions.
- **Quick-Access Chips**: 1-click start chips for your most frequent activities.

### 3. 🏆 Leaderboards & Deep Statistics
- **Period Breakdown**:
  - 🏆 **Weekly Leaderboard**: Ranked podium of activities for the current calendar week.
  - 📆 **Monthly Leaderboard**: Full month breakdown of time spent.
  - 🌐 **All-Time Leaderboard**: Lifetime podium and activity rankings.
  - 🔍 **Custom Date Range**: Pick any custom start and end date to instantly filter and aggregate your data.
- **Leaderboard Podium**: Gold (👑), Silver (🥈), and Bronze (🥉) medals for top activities, total hours, session count, and percentage share bars.
- **Visual Analytics**: Interactive Chart.js donut breakdown of activities and daily distribution bar charts.

### 4. 📱 Android 9+ & Offline-First Architecture
- **Target OS**: Fully optimized for **Android 9.0 Pie (API level 28)** and above via Capacitor and PWA standards.
- **Zero Internet Required**: All data is securely stored on your device using IndexedDB.
- **Backup & Restore**: Export full JSON backups, export CSV spreadsheets for Excel/Google Sheets, and load demo data for testing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- Android Studio (for native APK builds)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Build Web Production Bundle
```bash
npm run build
```

---

## 📱 Android 9+ (API 28+) Build Instructions

This project includes a pre-configured **Capacitor Android** project with `minSdkVersion = 28` (Android 9.0).

### Sync Web Assets to Android:
```bash
npm run build
npx cap sync android
```

### Open in Android Studio:
```bash
npx cap open android
```
From Android Studio:
1. Connect an Android 9+ device or start an emulator running Android 9 (API 28) or higher.
2. Click **Run 'app'** or select **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate the `.apk` file.

---

## 🔒 Privacy & Data Safety
No servers, no tracking, no ads. All your sessions and tags belong entirely to you on your device.
