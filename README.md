# ⏳ Running out of time

> A modern, offline-first Material 3 time-tracking and productivity intelligence application built for **Web & Android 9.0+ (API 28+)**.

---

## 🌟 Key Features

### 1. ⏱️ Time Running All the Time (Background Resilient)
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
