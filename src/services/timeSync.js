// Device Local Time Sync Service for "Running out of time"
// Synchronizes directly with the host device (Android / PC system clock and timezone)

class DeviceTimeSyncService {
  constructor() {
    this.deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  }

  // Current timestamp directly from host device
  now() {
    return Date.now();
  }

  // Get current device Date object
  getDeviceDate() {
    return new Date();
  }

  // Format current device time: e.g. "08:04:32 PM"
  formatLocalTime(timestamp = Date.now(), includeSeconds = true) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    });
  }

  // Format 24-hour time: e.g. "20:04:32"
  format24HourTime(timestamp = Date.now(), includeSeconds = true) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false
    });
  }

  // Calculate how much of the current day is remaining on the host device
  getDayRemainingInfo() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const totalDayMs = 24 * 3600 * 1000;
    const elapsedDayMs = now.getTime() - startOfDay;
    const remainingDayMs = Math.max(0, endOfDay - now.getTime());
    const percentElapsed = Math.min(100, Math.max(0, (elapsedDayMs / totalDayMs) * 100));

    return {
      currentTimestamp: now.getTime(),
      remainingMs: remainingDayMs,
      percentElapsed: Math.round(percentElapsed * 10) / 10,
      startOfDay,
      endOfDay
    };
  }

  getSyncInfo() {
    return {
      isSynced: true,
      label: `Synced to Device (${this.deviceTimezone})`,
      timezone: this.deviceTimezone
    };
  }
}

export const timeSync = new DeviceTimeSyncService();
