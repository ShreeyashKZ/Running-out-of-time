// Active Tracker & Relentless Time Engine for "Running out of time"
import { timerService, formatTickerTime, formatTimeOfDay, formatHumanDuration } from '../services/timer.js';
import { getAllTags } from '../services/db.js';
import { timeSync } from '../services/timeSync.js';

export class ActiveTracker {
  constructor(container, onSessionCompleted) {
    this.container = container;
    this.onSessionCompleted = onSessionCompleted;
    this.tagsList = [];
    this.activeSession = timerService.getActiveSession();
    this.unsubscribeTick = null;
    this.unsubscribeState = null;
    this.unsubscribeSync = null;

    this.init();
  }

  async init() {
    this.tagsList = await getAllTags();
    this.render();
    this.bindEvents();

    // Subscribe to the relentless master clock
    this.unsubscribeTick = timerService.onTick((tickData) => {
      this.updateTickingElements(tickData);
    });

    this.unsubscribeState = timerService.onStateChange((session) => {
      this.activeSession = session;
      this.render();
      this.bindEvents();
    });

    this.unsubscribeSync = timeSync.onSyncChange(() => {
      this.updateSyncBadge();
    });
  }

  destroy() {
    if (this.unsubscribeTick) this.unsubscribeTick();
    if (this.unsubscribeState) this.unsubscribeState();
    if (this.unsubscribeSync) this.unsubscribeSync();
  }

  render() {
    const isTracking = timerService.isActive();
    const currentTitle = this.activeSession ? this.activeSession.title : '';
    const dayStats = timerService.getDayTimeRemaining();
    const syncInfo = timeSync.getSyncInfo();
    const topQuickTags = this.tagsList.slice(0, 6);

    this.container.innerHTML = `
      <section class="tracker-view">
        <!-- Relentless Master Clock & Day Depletion (Always Running) -->
        <div class="m3-card hero-card relentless-hero ${isTracking ? 'is-active-tracking' : ''}">
          <!-- Sync & Mode Status Header -->
          <div class="hero-top-row">
            <div class="sync-badge" id="syncStatusBadge" title="Network monotonic time sync">
              <span class="sync-dot ${syncInfo.isSynced ? 'synced' : 'local'}"></span>
              <span class="sync-text">${syncInfo.label}</span>
            </div>

            <div class="day-depletion-pill">
              <span class="material-symbols-rounded pill-icon">hourglass_top</span>
              <span>Day Remaining: <strong id="heroDayRemaining">${dayStats.remainingFormatted}</strong></span>
            </div>
          </div>

          <!-- Main Continuous Digital Ticker -->
          <div class="time-display-wrapper">
            ${isTracking ? `
              <!-- Tracking an Activity -->
              <div class="counter-label">TRACKING SESSION DURATION</div>
              <div class="timer-digits ticking" id="mainTimerDigits">
                ${formatTickerTime(timerService.getActiveElapsedMs())}
              </div>
              <div class="timer-subtitle">
                <span class="live-pulse-badge">
                  <span class="pulse-dot"></span> Tracking Live
                </span>
                <span>• Started at ${formatTimeOfDay(this.activeSession.startTime)}</span>
              </div>
            ` : `
              <!-- Nothing explicitly tracked -> Clock runs relentlessly on untracked time -->
              <div class="counter-label">UNTRACKED TIME RUNNING (TIME IS RUNNING OUT)</div>
              <div class="timer-digits untracked-ticking" id="mainTimerDigits">
                ${formatTickerTime(timerService.getUntrackedElapsedMs())}
              </div>
              <div class="timer-subtitle">
                <span class="live-pulse-badge untracked-pulse">
                  <span class="pulse-dot untracked-dot"></span> Continuous Time Flow
                </span>
                <span id="heroCurrentClock">${formatTimeOfDay(timeSync.now())}</span>
              </div>
            `}

            <!-- Day Depletion Progress Bar -->
            <div class="day-progress-container" title="Percentage of day elapsed">
              <div class="day-progress-bar">
                <div class="day-progress-fill" id="heroDayProgressFill" style="width: ${dayStats.percentElapsed}%;"></div>
              </div>
              <div class="day-progress-label">
                <span>00:00</span>
                <span id="heroDayPercentLabel">${dayStats.percentElapsed}% of today is gone</span>
                <span>24:00</span>
              </div>
            </div>
          </div>

          <!-- Activity Controls & Autocomplete Input -->
          <div class="tracker-input-section" style="margin-top: 16px;">
            ${isTracking ? `
              <div class="current-activity-banner">
                <span class="banner-subtitle">Active Activity</span>
                <h2 class="banner-title">${escapeHTML(currentTitle)}</h2>
                ${this.activeSession.tags && this.activeSession.tags.length > 0 ? `
                  <div class="chips-container" style="justify-content: center; margin-top: 8px;">
                    ${this.activeSession.tags.map(t => `<span class="m3-chip active">#${escapeHTML(t)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="m3-field-container">
                <span class="material-symbols-rounded m3-field-icon">edit_note</span>
                <input
                  type="text"
                  id="activityInput"
                  class="m3-text-field"
                  placeholder="What are you doing right now? (e.g. Attending class)"
                  autocomplete="off"
                  value="${escapeHTML(currentTitle)}"
                />
                <div id="autocompleteDropdown" class="m3-autocomplete-panel" style="display: none;"></div>
              </div>

              <!-- Quick Tag Suggestions -->
              ${topQuickTags.length > 0 ? `
                <div style="margin-top: 14px;">
                  <div class="quick-tags-label">Frequent Activities & Tags:</div>
                  <div class="chips-container" id="quickChipsContainer">
                    ${topQuickTags.map(t => `
                      <button type="button" class="m3-chip quick-select-chip" data-title="${escapeHTML(t.displayName || t.name)}">
                        <span class="material-symbols-rounded" style="font-size: 14px;">history</span>
                        ${escapeHTML(t.displayName || t.name)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            `}
          </div>

          <!-- Action Buttons -->
          <div class="tracker-actions-row">
            ${isTracking ? `
              <button class="m3-fab-extended stop-fab" id="btnStopTimer">
                <span class="material-symbols-rounded">stop_circle</span>
                End & Record Session
              </button>
            ` : `
              <button class="m3-fab-extended" id="btnStartTimer">
                <span class="material-symbols-rounded">play_arrow</span>
                Start Tracking
              </button>

              <button class="m3-button tonal" id="btnClaimUntracked" title="Claim the currently elapsed untracked time into an activity">
                <span class="material-symbols-rounded">check_circle</span>
                Claim Elapsed Untracked Time
              </button>
            `}
          </div>
        </div>

        <!-- Offline & True Time Precision Details Card -->
        <div class="precision-card">
          <div class="precision-icon">
            <span class="material-symbols-rounded">shutter_speed</span>
          </div>
          <div class="precision-content">
            <h4>Atomic Precision • Offline Forever</h4>
            <p>
              Your time is synced once with network atomic time and cached with monotonic system counter. 
              Even offline, time continues running without drift and survives app closures, device sleep, or background pauses.
            </p>
          </div>
        </div>
      </section>
    `;
  }

  bindEvents() {
    const input = this.container.querySelector('#activityInput');
    const dropdown = this.container.querySelector('#autocompleteDropdown');
    const btnStart = this.container.querySelector('#btnStartTimer');
    const btnStop = this.container.querySelector('#btnStopTimer');
    const btnClaim = this.container.querySelector('#btnClaimUntracked');
    const quickChips = this.container.querySelectorAll('.quick-select-chip');

    // Quick Chip clicks
    quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.getAttribute('data-title');
        if (input) {
          input.value = val;
          input.focus();
        }
      });
    });

    // Start Tracking
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        const title = input ? input.value.trim() : 'Attending class';
        this.handleStart(title);
      });
    }

    // Stop Tracking
    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        await this.handleStop();
      });
    }

    // Claim Untracked Time
    if (btnClaim) {
      btnClaim.addEventListener('click', async () => {
        const title = input && input.value.trim() ? input.value.trim() : 'Attending class';
        const session = await timerService.claimUntrackedTime(title);
        if (this.onSessionCompleted) {
          this.onSessionCompleted(session);
        }
        if (input) input.value = '';
        this.render();
        this.bindEvents();
      });
    }

    // Autocomplete Input Handling
    if (input && dropdown) {
      input.addEventListener('input', () => {
        this.renderAutocomplete(input.value.trim(), dropdown, input);
      });

      input.addEventListener('focus', () => {
        if (input.value.trim().length > 0) {
          this.renderAutocomplete(input.value.trim(), dropdown, input);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const firstItem = dropdown.querySelector('.autocomplete-item');
          if (firstItem && dropdown.style.display !== 'none') {
            input.value = firstItem.getAttribute('data-val');
            dropdown.style.display = 'none';
          } else {
            this.handleStart(input.value.trim());
          }
        }
      });

      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }
  }

  renderAutocomplete(query, dropdown, input) {
    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    const q = query.toLowerCase();
    const matches = this.tagsList.filter(t => (t.displayName || t.name).toLowerCase().includes(q));

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = matches.slice(0, 6).map(m => {
      const name = m.displayName || m.name;
      const highlighted = highlightMatch(name, q);
      return `
        <div class="autocomplete-item" data-val="${escapeHTML(name)}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary);">label</span>
            <span>${highlighted}</span>
          </div>
          <span class="item-meta">
            ${m.useCount > 1 ? `${m.useCount} times` : 'previously used'}
          </span>
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.getAttribute('data-val');
        dropdown.style.display = 'none';
        input.focus();
      });
    });
  }

  handleStart(title) {
    const actTitle = title || 'Attending class';
    timerService.startTimer(actTitle, [actTitle.toLowerCase()]);
    getAllTags().then(tags => this.tagsList = tags);
  }

  async handleStop() {
    const completed = await timerService.stopTimer();
    if (completed && this.onSessionCompleted) {
      this.onSessionCompleted(completed);
    }
    this.tagsList = await getAllTags();
  }

  updateTickingElements(tickData) {
    const digits = this.container.querySelector('#mainTimerDigits');
    if (digits) {
      digits.textContent = tickData.isTracking 
        ? tickData.activeElapsedFormatted 
        : tickData.untrackedElapsedFormatted;
    }

    const dayRemaining = this.container.querySelector('#heroDayRemaining');
    if (dayRemaining) {
      dayRemaining.textContent = tickData.dayStats.remainingFormatted;
    }

    const progressFill = this.container.querySelector('#heroDayProgressFill');
    if (progressFill) {
      progressFill.style.width = `${tickData.dayStats.percentElapsed}%`;
    }

    const percentLabel = this.container.querySelector('#heroDayPercentLabel');
    if (percentLabel) {
      percentLabel.textContent = `${tickData.dayStats.percentElapsed}% of today is gone`;
    }

    const currentClock = this.container.querySelector('#heroCurrentClock');
    if (currentClock) {
      currentClock.textContent = tickData.currentTimeFormatted;
    }
  }

  updateSyncBadge() {
    const badge = this.container.querySelector('#syncStatusBadge');
    if (!badge) return;
    const syncInfo = timeSync.getSyncInfo();
    badge.innerHTML = `
      <span class="sync-dot ${syncInfo.isSynced ? 'synced' : 'local'}"></span>
      <span class="sync-text">${syncInfo.label}</span>
    `;
  }
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHTML(text);
  const before = text.substring(0, idx);
  const match = text.substring(idx, idx + query.length);
  const after = text.substring(idx + query.length);
  return `${escapeHTML(before)}<span class="match-highlight">${escapeHTML(match)}</span>${escapeHTML(after)}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
