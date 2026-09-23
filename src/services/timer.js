// Timer & Local Time Service for "Running out of time"
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
    const saved = getActiveTimerState();
    if (saved && saved.isRunning && saved.startTime) {
      this.activeSession = saved;
    }

    const all = await getAllSessions();
    if (all.length > 0) {
      this.lastSessionEndTime = all[0].endTime || all[0].startTime;
    }

    this.startMasterClock();
  }

  startMasterClock() {
    if (this.masterInterval) clearInterval(this.masterInterval);

    this.masterInterval = setInterval(() => {
      this.notifyTick();
    }, 1000);

    this.notifyTick();
  }

  // Start tracking with multiple tags and an explicit or derived title
  startTimer(tags = ['Attending class'], customStartTime = null, explicitTitle = null) {
    const cleanTags = Array.isArray(tags)
      ? tags.map(t => t.trim()).filter(Boolean)
      : [String(tags).trim()].filter(Boolean);

    const title = (explicitTitle && explicitTitle.trim())
      ? explicitTitle.trim()
      : (cleanTags[0] || 'Attending class');

    // Ensure title is included in tags for full leaderboard tracking
    if (!cleanTags.some(t => t.toLowerCase() === title.toLowerCase())) {
      cleanTags.unshift(title);
    }

    const startTime = customStartTime || timeSync.now();

    const sessionData = {
      title: title,
      tags: cleanTags,
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

  // Update session title directly
  setSessionTitle(newTitle) {
    if (!this.activeSession || !newTitle) return;
    const clean = newTitle.trim();
    if (!clean) return;

    this.activeSession.title = clean;
    if (!this.activeSession.tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      this.activeSession.tags.unshift(clean);
    }
    saveActiveTimerState(this.activeSession);
    this.notifyState();
    this.notifyTick();
  }

  // Make an existing tag the session title
  setTitleFromTag(tag) {
    if (!this.activeSession || !tag) return;
    this.setSessionTitle(tag);
  }

  // Add a tag to active running session dynamically
  addTagToActiveSession(tag) {
    if (!this.activeSession || !tag) return;
    const clean = tag.trim();
    if (!clean) return;

    if (!this.activeSession.tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      this.activeSession.tags.push(clean);
      saveActiveTimerState(this.activeSession);
      this.notifyState();
      this.notifyTick();
    }
  }

  // Remove a tag from active running session dynamically
  removeTagFromActiveSession(tag) {
    if (!this.activeSession || this.activeSession.tags.length <= 1) return;
    this.activeSession.tags = this.activeSession.tags.filter(
      t => t.toLowerCase() !== tag.toLowerCase()
    );
    this.activeSession.title = this.activeSession.tags.join(' • ');
    saveActiveTimerState(this.activeSession);
    this.notifyState();
    this.notifyTick();
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

    this.lastSessionEndTime = endTime;
    this.activeSession = null;
    saveActiveTimerState(null);

    this.notifyState();
    this.notifyTick();

    return completedSession;
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

  getSuggestedClaimTimes() {
    const now = new Date();
    const endMinutes = String(now.getMinutes()).padStart(2, '0');
    const endHours = String(now.getHours()).padStart(2, '0');
    const defaultEndTimeStr = `${endHours}:${endMinutes}`;

    let defaultStartTimeStr = '12:00';
    if (this.lastSessionEndTime) {
      const last = new Date(this.lastSessionEndTime);
      if (last.toDateString() === now.toDateString()) {
        const sh = String(last.getHours()).padStart(2, '0');
        const sm = String(last.getMinutes()).padStart(2, '0');
        defaultStartTimeStr = `${sh}:${sm}`;
      } else {
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        defaultStartTimeStr = `${String(oneHourAgo.getHours()).padStart(2, '0')}:${String(oneHourAgo.getMinutes()).padStart(2, '0')}`;
      }
    } else {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      defaultStartTimeStr = `${String(oneHourAgo.getHours()).padStart(2, '0')}:${String(oneHourAgo.getMinutes()).padStart(2, '0')}`;
    }

    return {
      dateStr: now.toISOString().split('T')[0],
      startTimeStr: defaultStartTimeStr,
      endTimeStr: defaultEndTimeStr
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
    const dayInfo = timeSync.getDayRemainingInfo();

    const tickPayload = {
      now,
      localTimeFormatted: timeSync.formatLocalTime(now),
      localTime24: timeSync.format24HourTime(now),
      activeElapsedMs: activeElapsed,
      activeElapsedFormatted: formatTickerTime(activeElapsed),
      dayRemainingMs: dayInfo.remainingMs,
      dayRemainingFormatted: formatTickerTime(dayInfo.remainingMs),
      dayRemainingHuman: formatHumanDuration(dayInfo.remainingMs),
      dayPercentElapsed: dayInfo.percentElapsed,
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
