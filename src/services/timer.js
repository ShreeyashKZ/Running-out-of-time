// Background-Resilient Timer Service for "Running out of time"
import { getActiveTimerState, saveActiveTimerState, addSession } from './db.js';

class TimerService {
  constructor() {
    this.activeSession = null;
    this.timerInterval = null;
    this.tickListeners = new Set();
    this.stateListeners = new Set();

    // Rehydrate from localStorage immediately
    this.init();
  }

  init() {
    const saved = getActiveTimerState();
    if (saved && saved.isRunning && saved.startTime) {
      this.activeSession = saved;
      this.startTicking();
    }
  }

  startTimer(title = 'Attending class', tags = [], customStartTime = null) {
    const startTime = customStartTime || Date.now();
    const sessionData = {
      title: title.trim() || 'Untitled Activity',
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      startTime: startTime,
      isRunning: true,
      notes: ''
    };

    this.activeSession = sessionData;
    saveActiveTimerState(this.activeSession);
    this.startTicking();
    this.notifyStateListeners();
    return this.activeSession;
  }

  async stopTimer() {
    if (!this.activeSession) return null;

    const endTime = Date.now();
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

    // Stop ticking & clear active state
    this.stopTicking();
    this.activeSession = null;
    saveActiveTimerState(null);
    this.notifyStateListeners();

    return completedSession;
  }

  startTicking() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.notifyTickListeners();
    }, 1000);
    this.notifyTickListeners();
  }

  stopTicking() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  isActive() {
    return Boolean(this.activeSession && this.activeSession.isRunning);
  }

  getActiveSession() {
    return this.activeSession;
  }

  getElapsedMs() {
    if (!this.activeSession) return 0;
    return Math.max(0, Date.now() - this.activeSession.startTime);
  }

  onTick(callback) {
    this.tickListeners.add(callback);
    return () => this.tickListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  notifyTickListeners() {
    const elapsedMs = this.getElapsedMs();
    const formatted = formatTickerTime(elapsedMs);
    for (const listener of this.tickListeners) {
      try {
        listener(elapsedMs, formatted, this.activeSession);
      } catch (err) {
        console.error('Tick listener error:', err);
      }
    }
  }

  notifyStateListeners() {
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

// Format to HH:MM:SS
export function formatTickerTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// User requested exact human duration: e.g. "3 hour 5 minutes"
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

// Compact string for badges: e.g. "3h 5m"
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

// Format 12-hour time: "12:25 PM"
export function formatTimeOfDay(timestamp) {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Format date: "Wednesday, Sep 23, 2026"
export function formatDateLabel(dateStrOrTs) {
  const d = new Date(dateStrOrTs);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export const timerService = new TimerService();
