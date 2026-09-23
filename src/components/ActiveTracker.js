// Active Tracker & Local Device Timepiece for "Running out of time"
import { timerService, formatTickerTime, formatTimeOfDay, formatHumanDuration } from '../services/timer.js';
import { getAllTags } from '../services/db.js';
import { timeSync } from '../services/timeSync.js';

export class ActiveTracker {
  constructor(container, onSessionCompleted, onOpenClaimModal) {
    this.container = container;
    this.onSessionCompleted = onSessionCompleted;
    this.onOpenClaimModal = onOpenClaimModal;
    this.tagsList = [];
    this.activeSession = timerService.getActiveSession();
    this.unsubscribeTick = null;
    this.unsubscribeState = null;

    this.init();
  }

  async init() {
    this.tagsList = await getAllTags();
    this.render();
    this.bindEvents();

    // Subscribe to the device clock & day remaining ticker
    this.unsubscribeTick = timerService.onTick((tickData) => {
      this.updateTickingElements(tickData);
    });

    this.unsubscribeState = timerService.onStateChange((session) => {
      this.activeSession = session;
      this.render();
      this.bindEvents();
    });
  }

  destroy() {
    if (this.unsubscribeTick) this.unsubscribeTick();
    if (this.unsubscribeState) this.unsubscribeState();
  }

  render() {
    const isTracking = timerService.isActive();
    const currentTitle = this.activeSession ? this.activeSession.title : '';
    const dayInfo = timeSync.getDayRemainingInfo();
    const now = Date.now();
    const syncInfo = timeSync.getSyncInfo();
    const topQuickTags = this.tagsList.slice(0, 6);

    this.container.innerHTML = `
      <section class="tracker-view">
        <!-- Hero Clock & Day Remaining Display -->
        <div class="m3-card hero-card relentless-hero ${isTracking ? 'is-active-tracking' : ''}">
          <!-- Device Sync Header -->
          <div class="hero-top-row">
            <div class="sync-badge" id="syncStatusBadge">
              <span class="sync-dot synced"></span>
              <span class="sync-text">${syncInfo.label}</span>
            </div>

            <div class="day-depletion-pill">
              <span class="material-symbols-rounded pill-icon">hourglass_top</span>
              <span>Day Remaining: <strong id="heroDayRemaining">${formatTickerTime(dayInfo.remainingMs)}</strong></span>
            </div>
          </div>

          <!-- Main Digital Readout -->
          <div class="time-display-wrapper">
            ${isTracking ? `
              <!-- Active Tracking Session -->
              <div class="counter-label">ACTIVE SESSION DURATION</div>
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
              <!-- Idle Mode: Real-time Device Local Clock -->
              <div class="counter-label">LOCAL DEVICE TIME</div>
              <div class="timer-digits" id="mainTimerDigits">
                ${timeSync.formatLocalTime(now)}
              </div>
              <div class="timer-subtitle">
                <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-primary);">schedule</span>
                <span id="heroDayRemainingHuman">${formatHumanDuration(dayInfo.remainingMs)} left in today</span>
              </div>
            `}

            <!-- Day Depletion Progress Gauge -->
            <div class="day-progress-container" title="Elapsed percentage of today">
              <div class="day-progress-bar">
                <div class="day-progress-fill" id="heroDayProgressFill" style="width: ${dayInfo.percentElapsed}%;"></div>
              </div>
              <div class="day-progress-label">
                <span>00:00</span>
                <span id="heroDayPercentLabel">${dayInfo.percentElapsed}% of today has elapsed</span>
                <span>24:00</span>
              </div>
            </div>
          </div>

          <!-- Activity Input Section with Intelligent Autocomplete -->
          <div class="tracker-input-section" style="margin-top: 18px;">
            ${isTracking ? `
              <div class="current-activity-banner">
                <span class="banner-subtitle">Current Task</span>
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

              <!-- Quick Tag Suggestions from Memory -->
              ${topQuickTags.length > 0 ? `
                <div style="margin-top: 14px;">
                  <div class="quick-tags-label">Recent Activities & Tags:</div>
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

              <button class="m3-button tonal" id="btnClaimElapsed">
                <span class="material-symbols-rounded">more_time</span>
                Claim Elapsed Time / Log Past Activity
              </button>
            `}
          </div>
        </div>

        <!-- Offline & Local Sync Details Card -->
        <div class="precision-card">
          <div class="precision-icon">
            <span class="material-symbols-rounded">devices</span>
          </div>
          <div class="precision-content">
            <h4>Synced with Device • 100% Offline</h4>
            <p>
              Synchronized directly with your host device's local clock and timezone (${syncInfo.timezone}).
              No internet connection required. All activity sessions, tags, and stats remain securely stored on your device.
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
    const btnClaim = this.container.querySelector('#btnClaimElapsed');
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

    // Start Tracking Action
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        const title = input ? input.value.trim() : 'Attending class';
        this.handleStart(title);
      });
    }

    // Stop Tracking Action
    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        await this.handleStop();
      });
    }

    // Claim Elapsed Time Action (Opens interface to select day, time and activity name)
    if (btnClaim) {
      btnClaim.addEventListener('click', () => {
        const currentInputTitle = input ? input.value.trim() : '';
        if (this.onOpenClaimModal) {
          this.onOpenClaimModal(currentInputTitle);
        }
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
        : tickData.localTimeFormatted;
    }

    const dayRemaining = this.container.querySelector('#heroDayRemaining');
    if (dayRemaining) {
      dayRemaining.textContent = tickData.dayRemainingFormatted;
    }

    const dayHuman = this.container.querySelector('#heroDayRemainingHuman');
    if (dayHuman) {
      dayHuman.textContent = `${tickData.dayRemainingHuman} left in today`;
    }

    const progressFill = this.container.querySelector('#heroDayProgressFill');
    if (progressFill) {
      progressFill.style.width = `${tickData.dayPercentElapsed}%`;
    }

    const percentLabel = this.container.querySelector('#heroDayPercentLabel');
    if (percentLabel) {
      percentLabel.textContent = `${tickData.dayPercentElapsed}% of today has elapsed`;
    }
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
