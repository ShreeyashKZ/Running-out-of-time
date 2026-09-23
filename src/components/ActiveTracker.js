// Active Tracker Component for "Running out of time"
import { timerService, formatTickerTime, formatTimeOfDay, formatHumanDuration } from '../services/timer.js';
import { getAllTags } from '../services/db.js';

export class ActiveTracker {
  constructor(container, onSessionCompleted) {
    this.container = container;
    this.onSessionCompleted = onSessionCompleted;
    this.tagsList = [];
    this.selectedTags = new Set();
    this.activeSession = timerService.getActiveSession();
    this.unsubscribeTick = null;
    this.unsubscribeState = null;

    this.init();
  }

  async init() {
    this.tagsList = await getAllTags();
    this.render();
    this.bindEvents();

    // Subscribe to timer ticks and state changes
    this.unsubscribeTick = timerService.onTick((elapsedMs, formatted) => {
      this.updateTickerDisplay(formatted);
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
    const isActive = timerService.isActive();
    const currentTitle = this.activeSession ? this.activeSession.title : '';
    const initialTicker = formatTickerTime(timerService.getElapsedMs());
    const startTimeText = this.activeSession ? formatTimeOfDay(this.activeSession.startTime) : null;

    // Top frequent suggestions
    const topQuickTags = this.tagsList.slice(0, 6);

    this.container.innerHTML = `
      <section class="tracker-view">
        <!-- Hero Active Ticker Card -->
        <div class="m3-card hero-card ${isActive ? 'is-active-tracking' : ''}">
          <div class="time-display-wrapper">
            <div class="timer-digits ${isActive ? 'ticking' : ''}" id="mainTimerDigits">
              ${initialTicker}
            </div>
            <div class="timer-subtitle">
              ${isActive ? `
                <span class="live-pulse-badge">
                  <span class="pulse-dot"></span> Tracking Live
                </span>
                <span>• Started at ${startTimeText}</span>
              ` : `
                <span class="material-symbols-rounded" style="font-size: 18px;">schedule</span>
                <span>Ready to start tracking</span>
              `}
            </div>
          </div>

          <!-- Activity Input with Intelligent Autocomplete -->
          <div class="tracker-input-section" style="margin-top: 20px;">
            ${isActive ? `
              <div class="current-activity-banner" style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 0.85rem; color: var(--md-sys-color-outline); text-transform: uppercase; letter-spacing: 0.5px;">Current Activity</span>
                <h2 style="font-family: var(--font-family-brand); font-size: 1.6rem; color: var(--md-sys-color-primary); margin-top: 4px;">
                  ${escapeHTML(currentTitle)}
                </h2>
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

              <!-- Quick Tag suggestions from memory -->
              ${topQuickTags.length > 0 ? `
                <div style="margin-top: 14px;">
                  <div style="font-size: 0.8rem; color: var(--md-sys-color-outline); margin-bottom: 6px;">
                    Recent activities & tags:
                  </div>
                  <div class="chips-container" id="quickChipsContainer">
                    ${topQuickTags.map(t => `
                      <button type="button" class="m3-chip quick-select-chip" data-title="${escapeHTML(t.displayName || t.name)}">
                        <span class="material-symbols-rounded" style="font-size: 15px;">history</span>
                        ${escapeHTML(t.displayName || t.name)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            `}
          </div>

          <!-- Controls: Start / Stop FAB -->
          <div style="display: flex; justify-content: center; margin-top: 28px;">
            ${isActive ? `
              <button class="m3-fab-extended stop-fab" id="btnStopTimer">
                <span class="material-symbols-rounded">stop</span>
                End & Record Session
              </button>
            ` : `
              <button class="m3-fab-extended" id="btnStartTimer">
                <span class="material-symbols-rounded">play_arrow</span>
                Start Tracking
              </button>
            `}
          </div>
        </div>

        <!-- Productivity Philosophy & Shortcuts Card -->
        <div class="m3-card" style="margin-top: 24px; display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; border-radius: var(--shape-corner-lg); background-color: var(--md-sys-color-secondary-container); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-rounded" style="font-size: 26px; color: var(--md-sys-color-on-secondary-container);">offline_bolt</span>
          </div>
          <div>
            <h4 style="font-family: var(--font-family-brand); font-size: 1.05rem; margin-bottom: 2px;">Offline & Background Resilient</h4>
            <p style="font-size: 0.85rem; color: var(--md-sys-color-outline);">
              Time continues accurately even when this tab is closed or your device sleeps. All your sessions and tags are stored 100% locally.
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

    // Start Timer Action
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        const title = input ? input.value.trim() : 'Attending class';
        this.handleStart(title);
      });
    }

    // Stop Timer Action
    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        await this.handleStop();
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

      // Close dropdown when clicking outside
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
    // Refresh tags list for future
    getAllTags().then(tags => this.tagsList = tags);
  }

  async handleStop() {
    const completed = await timerService.stopTimer();
    if (completed && this.onSessionCompleted) {
      this.onSessionCompleted(completed);
    }
    this.tagsList = await getAllTags();
  }

  updateTickerDisplay(formatted) {
    const digits = this.container.querySelector('#mainTimerDigits');
    if (digits) {
      digits.textContent = formatted;
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
