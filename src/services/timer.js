// Relentless Continuous Timer & Master Timepiece Service for "Running out of time"
import { getActiveTimerState, saveActiveTimerState, addSession, getAllSessions } from './db.js';
import { timeSync } from './timeSync.js';

class TimerService {
  constructor() {
    this.activeSession = null;
    this.masterInterval = null;
    this.tickListeners = new Set();
    this.stateListeners = new Set();
    this.lastSessionEndTime = null;

    this.init();
  }

  async init() {
    // Rehydrate active tracking session
    const saved = getActiveTimerState();
    if (saved && saved.isRunning && saved.startTime) {
      this.activeSession = saved;
    }

    // Determine when the last tracked session finished to calculate untracked time
    const all = await getAllSessions();
    if (all.length > 0) {
      this.lastSessionEndTime = all[0].endTime || all[0].startTime;
    } else {
      this.lastSessionEndTime = timeSync.now();
    }

    // Master Clock runs 24/7/365 unconditionally
    this.startMasterClock();
  }

  startMasterClock() {
    if (this.masterInterval) clearInterval(this.masterInterval);

    this.masterInterval = setInterval(() => {
      this.notifyTick();
    }, 1000);

    this.notifyTick();
  }

  startTimer(title = 'Attending class', tags = [], customStartTime = null) {
    const startTime = customStartTime || timeSync.now();
    const sessionData = {
      title: title.trim() || 'Untitled Activity',
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      startTime: startTime,
      isRunning: true,
      notes: ''
    };

    this.activeSession = sessionData;
    saveActiveTimerState(this.activeSession);
    this.notifyState();
    this.notifyTick();
    return this.activeSession;
  }

  async stopTimer() {
    if (!this.activeSession) return null;

    const endTime = timeSync.now();
    const startTime = this.activeSession.startTime;
    const durationMs = Math.max(0, endTime - startTime);
    const startDate = new Date(startTime);
    const dateStr = startDate.toISOString().split('T')[0];

    const completedSession = {
      title: this.activeSession.title,
      tags: this.activeSession.tags,
      startTime: startTime,
      endTime: endTime,
      durationMs: durationMs,
      dateStr: dateStr,
      notes: this.activeSession.notes || ''
    };

    // Save to IndexedDB
    await addSession(completedSession);

    // Update last session end time for untracked time counter
    this.lastSessionEndTime = endTime;

    this.activeSession = null;
    saveActiveTimerState(null);

    this.notifyState();
    this.notifyTick();

    return completedSession;
  }

  // Claim the ongoing untracked time retroactively
  async claimUntrackedTime(title, tags = []) {
    const now = timeSync.now();
    const startTime = this.lastSessionEndTime || (now - 15 * 60 * 1000);
    const durationMs = Math.max(0, now - startTime);
    const startDate = new Date(startTime);
    const dateStr = startDate.toISOString().split('T')[0];

    const session = {
      title: title.trim() || 'Untitled Activity',
      tags: Array.isArray(tags) ? tags : [title.trim().toLowerCase()],
      startTime,
      endTime: now,
      durationMs,
      dateStr,
      notes: 'Claimed from untracked time'
    };

    await addSession(session);
    this.lastSessionEndTime = now;
    this.notifyTick();
    return session;
  }

  isActive() {
    return Boolean(this.activeSession && this.activeSession.isRunning);
  }

  getActiveSession() {
    return this.activeSession;
  }

  getActiveElapsedMs() {
    if (!this.activeSession) return 0;
    return Math.max(0, timeSync.now() - this.activeSession.startTime);
  }

  getUntrackedElapsedMs() {
    if (this.isActive()) return 0;
    if (!this.lastSessionEndTime) return 0;
    return Math.max(0, timeSync.now() - this.lastSessionEndTime);
  }

  // Get Day Remaining Progress (Running out of time core metric)
  getDayTimeRemaining() {
    const now = new Date(timeSync.now());
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const totalDayMs = 24 * 3600 * 1000;
    const elapsedDayMs = now.getTime() - startOfDay;
    const remainingDayMs = Math.max(0, endOfDay - now.getTime());
    const percentElapsed = Math.min(100, Math.max(0, (elapsedDayMs / totalDayMs) * 100));

    return {
      currentTimestamp: now.getTime(),
      remainingMs: remainingDayMs,
      remainingFormatted: formatTickerTime(remainingDayMs),
      remainingHuman: formatHumanDuration(remainingDayMs),
      percentElapsed: Math.round(percentElapsed * 10) / 10
    };
  }

  onTick(callback) {
    this.tickListeners.add(callback);
    return () => this.tickListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  notifyTick() {
    const now = timeSync.now();
    const activeElapsed = this.getActiveElapsedMs();
    const untrackedElapsed = this.getUntrackedElapsedMs();
    const dayStats = this.getDayTimeRemaining();

    const tickPayload = {
      now,
      currentTimeFormatted: formatTimeOfDay(now),
      activeElapsedMs: activeElapsed,
      activeElapsedFormatted: formatTickerTime(activeElapsed),
      untrackedElapsedMs: untrackedElapsed,
      untrackedElapsedFormatted: formatTickerTime(untrackedElapsed),
      dayStats,
      activeSession: this.activeSession,
      isTracking: this.isActive()
    };

    for (const listener of this.tickListeners) {
      try {
        listener(tickPayload);
      } catch (err) {
        console.error('Tick listener error:', err);
      }
    }
  }

  notifyState() {
    for (const listener of this.stateListeners) {
      try {
        listener(this.activeSession);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }
}

// ==================== FORMATTERS ====================

export function formatTickerTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatHumanDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0 || (hours === 0 && seconds === 0)) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (hours === 0 && minutes < 5 && seconds > 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ') || '0 minutes';
}

export function formatCompactDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

export function formatTimeOfDay(timestamp) {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function formatDateLabel(dateStrOrTs) {
  const d = new Date(dateStrOrTs);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export const timerService = new TimerService();
