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
    this.selectedTags = new Set(['Attending class']); // default starting tag
    this.activeSession = timerService.getActiveSession();
    this.unsubscribeTick = null;
    this.unsubscribeState = null;

    this.init();
  }

  async init() {
    this.tagsList = await getAllTags();
    this.render();
    this.bindEvents();

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
    const dayInfo = timeSync.getDayRemainingInfo();
    const now = Date.now();
    const syncInfo = timeSync.getSyncInfo();

    // Quick tag suggestions that aren't already selected
    const selectedLower = new Set(Array.from(this.selectedTags).map(t => t.toLowerCase()));
    const suggestedTags = this.tagsList
      .filter(t => !selectedLower.has((t.displayName || t.name).toLowerCase()))
      .slice(0, 8);

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

          <!-- Multi-Tag / Multi-Title Section -->
          <div class="tracker-tags-section" style="margin-top: 18px;">
            ${isTracking ? `
              <!-- Active Session Multiple Tags Display & Dynamic Addition -->
              <div class="current-activity-banner">
                <span class="banner-subtitle">Session Activities & Tags</span>
                <div class="active-session-tags-wrapper" style="margin-top: 8px;">
                  <div class="chips-container" style="justify-content: center;" id="activeSessionChips">
                    ${this.activeSession.tags.map(t => `
                      <span class="m3-chip active" style="font-weight: 600;">
                        <span class="material-symbols-rounded" style="font-size: 15px;">label</span>
                        ${escapeHTML(t)}
                        ${this.activeSession.tags.length > 1 ? `
                          <span class="chip-remove btn-remove-active-tag" data-tag="${escapeHTML(t)}" title="Remove tag">×</span>
                        ` : ''}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Add another tag while tracking is live -->
                <div style="margin-top: 12px; display: flex; justify-content: center;">
                  <div class="inline-add-tag-form" style="position: relative; max-width: 320px; width: 100%;">
                    <input
                      type="text"
                      id="inputAddActiveTag"
                      class="m3-text-field"
                      style="height: 38px; padding: 6px 14px 6px 36px; font-size: 0.88rem; border-radius: var(--shape-corner-full);"
                      placeholder="+ Add another title/tag..."
                      autocomplete="off"
                    />
                    <span class="material-symbols-rounded m3-field-icon" style="left: 10px; font-size: 18px;">add</span>
                    <div id="activeTagAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
                  </div>
                </div>
              </div>
            ` : `
              <!-- Pre-Tracking Multi-Tag Editor -->
              <div class="multi-tag-box">
                <div class="multi-tag-header">
                  <span class="field-label-text">Activities / Titles in this Session (Multiple Allowed):</span>
                  <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Press Enter or Comma to add</span>
                </div>

                <!-- Selected Tag Chips with Delete Action -->
                <div class="selected-tags-strip" id="selectedTagsStrip">
                  ${Array.from(this.selectedTags).map(tag => `
                    <span class="m3-chip active session-tag-chip" data-tag="${escapeHTML(tag)}">
                      <span class="material-symbols-rounded" style="font-size: 15px;">label</span>
                      ${escapeHTML(tag)}
                      <span class="chip-remove btn-remove-tag" data-tag="${escapeHTML(tag)}" title="Remove">×</span>
                    </span>
                  `).join('')}
                </div>

                <!-- Tag Input with Autocomplete -->
                <div class="m3-field-container" style="margin-top: 8px;">
                  <span class="material-symbols-rounded m3-field-icon">new_label</span>
                  <input
                    type="text"
                    id="tagInput"
                    class="m3-text-field"
                    placeholder="Type an activity (e.g. Attending class, Math, Homework) and press Enter"
                    autocomplete="off"
                  />
                  <div id="tagAutocompleteDropdown" class="m3-autocomplete-panel" style="display: none;"></div>
                </div>

                <!-- Quick Tag Suggestions from Memory -->
                ${suggestedTags.length > 0 ? `
                  <div style="margin-top: 12px;">
                    <div class="quick-tags-label">Quick add past activities:</div>
                    <div class="chips-container" id="quickChipsContainer">
                      ${suggestedTags.map(t => `
                        <button type="button" class="m3-chip quick-add-chip" data-title="${escapeHTML(t.displayName || t.name)}">
                          <span class="material-symbols-rounded" style="font-size: 14px;">add</span>
                          ${escapeHTML(t.displayName || t.name)}
                        </button>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
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
            <h4>Multi-Title Time Tracking • Device Synced</h4>
            <p>
              A single time session can carry multiple titles and tags. Each activity accumulates towards your weekly, 
              monthly, and all-time leaderboards so you can measure everything you accomplish simultaneously.
            </p>
          </div>
        </div>
      </section>
    `;
  }

  bindEvents() {
    const isTracking = timerService.isActive();
    const btnStart = this.container.querySelector('#btnStartTimer');
    const btnStop = this.container.querySelector('#btnStopTimer');
    const btnClaim = this.container.querySelector('#btnClaimElapsed');

    // ==================== PRE-TRACKING TAG CONTROLS ====================
    if (!isTracking) {
      const tagInput = this.container.querySelector('#tagInput');
      const dropdown = this.container.querySelector('#tagAutocompleteDropdown');
      const removeButtons = this.container.querySelectorAll('.btn-remove-tag');
      const quickAddChips = this.container.querySelectorAll('.quick-add-chip');

      // Remove a tag from selected list
      removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          this.selectedTags.delete(tag);
          this.render();
          this.bindEvents();
        });
      });

      // Quick add tag from suggestions
      quickAddChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const val = chip.getAttribute('data-title');
          if (val) {
            this.selectedTags.add(val);
            this.render();
            this.bindEvents();
          }
        });
      });

      const addTagFromInput = () => {
        if (!tagInput) return;
        const val = tagInput.value.trim().replace(/^,+|,+$/g, '');
        if (val) {
          this.selectedTags.add(val);
          tagInput.value = '';
          if (dropdown) dropdown.style.display = 'none';
          this.render();
          this.bindEvents();
          const newInput = this.container.querySelector('#tagInput');
          if (newInput) newInput.focus();
        }
      };

      if (tagInput && dropdown) {
        tagInput.addEventListener('input', () => {
          const q = tagInput.value.trim();
          if (q.includes(',')) {
            addTagFromInput();
            return;
          }
          this.renderAutocomplete(q, dropdown, (selectedTag) => {
            this.selectedTags.add(selectedTag);
            tagInput.value = '';
            dropdown.style.display = 'none';
            this.render();
            this.bindEvents();
          });
        });

        tagInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const firstItem = dropdown.querySelector('.autocomplete-item');
            if (firstItem && dropdown.style.display !== 'none') {
              this.selectedTags.add(firstItem.getAttribute('data-val'));
              tagInput.value = '';
              dropdown.style.display = 'none';
              this.render();
              this.bindEvents();
            } else {
              addTagFromInput();
            }
          }
        });

        document.addEventListener('click', (e) => {
          if (!tagInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }

      // Start Tracking Action
      if (btnStart) {
        btnStart.addEventListener('click', () => {
          // If user typed something in the input without pressing Enter, add it now
          if (tagInput && tagInput.value.trim()) {
            this.selectedTags.add(tagInput.value.trim());
          }

          const tagsArray = Array.from(this.selectedTags).filter(Boolean);
          const finalTags = tagsArray.length > 0 ? tagsArray : ['Attending class'];
          timerService.startTimer(finalTags);
          getAllTags().then(tags => this.tagsList = tags);
        });
      }

      // Claim Elapsed Time Action
      if (btnClaim) {
        btnClaim.addEventListener('click', () => {
          const currentTags = Array.from(this.selectedTags);
          if (this.onOpenClaimModal) {
            this.onOpenClaimModal(currentTags);
          }
        });
      }
    }

    // ==================== ACTIVE TRACKING LIVE TAG CONTROLS ====================
    if (isTracking) {
      const activeInput = this.container.querySelector('#inputAddActiveTag');
      const activeDropdown = this.container.querySelector('#activeTagAutocomplete');
      const removeActiveButtons = this.container.querySelectorAll('.btn-remove-active-tag');

      removeActiveButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          timerService.removeTagFromActiveSession(tag);
        });
      });

      if (activeInput && activeDropdown) {
        activeInput.addEventListener('input', () => {
          const q = activeInput.value.trim();
          this.renderAutocomplete(q, activeDropdown, (selectedTag) => {
            timerService.addTagToActiveSession(selectedTag);
            activeInput.value = '';
            activeDropdown.style.display = 'none';
          });
        });

        activeInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = activeInput.value.trim();
            if (val) {
              timerService.addTagToActiveSession(val);
              activeInput.value = '';
              activeDropdown.style.display = 'none';
            }
          }
        });

        document.addEventListener('click', (e) => {
          if (!activeInput.contains(e.target) && !activeDropdown.contains(e.target)) {
            activeDropdown.style.display = 'none';
          }
        });
      }

      if (btnStop) {
        btnStop.addEventListener('click', async () => {
          const completed = await timerService.stopTimer();
          if (completed && this.onSessionCompleted) {
            this.onSessionCompleted(completed);
          }
          this.tagsList = await getAllTags();
        });
      }
    }
  }

  renderAutocomplete(query, dropdown, onSelect) {
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
            ${m.useCount > 1 ? `${m.useCount}x used` : 'previous'}
          </span>
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-val');
        onSelect(val);
      });
    });
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
