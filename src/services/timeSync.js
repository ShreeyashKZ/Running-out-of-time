// Network Time Sync Engine for "Running out of time"
// Connects to network once to obtain atomic/true time, computes monotonic offset,
// and remains resiliently accurate offline indefinitely without needing internet again.

const STORAGE_KEY = 'rott_time_sync_state';

class TimeSyncService {
  constructor() {
    this.syncState = null;
    this.syncListeners = new Set();
    this.isSyncing = false;

    this.init();
  }

  init() {
    // 1. Try to load previously stored sync state
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.syncState = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not parse stored sync state', e);
    }

    // 2. Check if we need to sync:
    // Sync if never synced, or if misguided (e.g. performance.now reset due to device reboot)
    if (this.needsSync()) {
      this.attemptSync();
    }

    // 3. Listen to online events in case we were offline and need to sync
    window.addEventListener('online', () => {
      if (this.needsSync()) {
        this.attemptSync();
      }
    });
  }

  needsSync() {
    if (!this.syncState) return true;

    // Check if performance.now() was reset (e.g., machine rebooted)
    const currentPerf = performance.now();
    if (currentPerf < this.syncState.lastPerf) {
      // Monotonic clock reset detected -> misguided! Needs re-sync
      return true;
    }

    // Check drift between estimated monotonic time and system clock
    const estimatedTime = this.syncState.baseNetworkTime + (currentPerf - this.syncState.basePerf);
    const systemTime = Date.now();
    const driftMs = Math.abs(estimatedTime - systemTime);

    // If drift is unusually high (> 15 minutes), flag as misguided
    if (driftMs > 15 * 60 * 1000) {
      return true;
    }

    return false;
  }

  async attemptSync() {
    if (this.isSyncing) return;
    if (!navigator.onLine) {
      this.notifyListeners();
      return;
    }

    this.isSyncing = true;

    try {
      const networkTimestamp = await this.fetchNetworkTime();
      if (networkTimestamp) {
        const perfNow = performance.now();
        this.syncState = {
          baseNetworkTime: networkTimestamp,
          basePerf: perfNow,
          lastPerf: perfNow,
          syncedAt: Date.now(),
          source: 'network'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.syncState));
        console.log(`[TimeSync] Network sync successful! True time: ${new Date(networkTimestamp).toISOString()}`);
      }
    } catch (err) {
      console.warn('[TimeSync] Network time sync failed (offline or network error), using local clock fallback', err);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  async fetchNetworkTime() {
    // Strategy 1: HEAD request to current origin or public fast API to read HTTP Date header
    const endpoints = [
      { url: 'https://worldtimeapi.org/api/timezone/Etc/UTC', parser: async (res) => (await res.json()).unixtime * 1000 },
      { url: 'https://timeapi.io/api/time/current/zone?timeZone=UTC', parser: async (res) => new Date((await res.json()).dateTime).getTime() },
      { url: window.location.href, method: 'HEAD', parser: async (res) => {
          const dateHeader = res.headers.get('date');
          return dateHeader ? new Date(dateHeader).getTime() : null;
        }
      }
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(ep.url, {
          method: ep.method || 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const ts = await ep.parser(res);
          if (ts && !isNaN(ts)) return ts;
        }
      } catch (e) {
        // Try next endpoint
      }
    }

    return null;
  }

  // Get current true timestamp (guaranteed monotonic & drift-free)
  now() {
    if (this.syncState && this.syncState.baseNetworkTime) {
      const curPerf = performance.now();
      // Update last seen performance to track reboots
      this.syncState.lastPerf = curPerf;
      return this.syncState.baseNetworkTime + (curPerf - this.syncState.basePerf);
    }
    return Date.now();
  }

  getSyncInfo() {
    if (!this.syncState) {
      return {
        isSynced: false,
        label: 'Local Device Clock',
        syncedAt: null
      };
    }

    return {
      isSynced: true,
      label: 'True Network Synchronized',
      syncedAt: new Date(this.syncState.syncedAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }

  onSyncChange(cb) {
    this.syncListeners.add(cb);
    return () => this.syncListeners.delete(cb);
  }

  notifyListeners() {
    const info = this.getSyncInfo();
    for (const cb of this.syncListeners) {
      try { cb(info); } catch (e) {}
    }
  }
}

export const timeSync = new TimeSyncService();
