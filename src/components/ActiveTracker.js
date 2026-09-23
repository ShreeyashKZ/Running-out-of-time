// Active Tracker & Local Device Timepiece for "Root"
import { timerService, formatTickerTime, formatTimeOfDay, formatHumanDuration } from '../services/timer.js';
import { getAllTags } from '../services/db.js';
import { timeSync } from '../services/timeSync.js';
import { DailyBreakdownView } from './DailyBreakdownView.js';

export class ActiveTracker {
  constructor(container, onSessionCompleted, onOpenClaimModal) {
    this.container = container;
    this.onSessionCompleted = onSessionCompleted;
    this.onOpenClaimModal = onOpenClaimModal;
    this.tagsList = [];
    this.sessionTitle = 'Attending class';
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

    const currentTitle = isTracking 
      ? this.activeSession.title 
      : this.sessionTitle;

    const currentTags = isTracking 
      ? this.activeSession.tags 
      : Array.from(this.selectedTags);

    const topSuggestions = this.tagsList.slice(0, 8);

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

          <!-- Session Title & Tags Section -->
          <div class="tracker-form-section" style="margin-top: 18px;">
            ${isTracking ? `
              <!-- Live Session Banner with Title & Tags -->
              <div class="current-activity-banner">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span class="banner-subtitle">Current Session Title:</span>
                </div>
                <h2 class="banner-title">${escapeHTML(currentTitle)}</h2>

                <!-- Active Tags -->
                <div style="margin-top: 10px;">
                  <div class="field-sublabel-text" style="text-align: center; margin-bottom: 6px;">Attached Tags & Sub-activities:</div>
                  <div class="chips-container" style="justify-content: center;" id="activeSessionChips">
                    ${currentTags.map(t => `
                      <span class="m3-chip active" style="font-weight: 600;">
                        <span class="material-symbols-rounded" style="font-size: 14px;">label</span>
                        <span>${escapeHTML(t)}</span>
                        ${t.toLowerCase() !== currentTitle.toLowerCase() ? `
                          <button type="button" class="btn-make-tag-title" data-tag="${escapeHTML(t)}" title="Make this tag the session title" style="background:none;border:none;color:inherit;cursor:pointer;display:inline-flex;align-items:center;margin-left:2px;opacity:0.8;">
                            <span class="material-symbols-rounded" style="font-size: 14px;">swap_horiz</span>
                          </button>
                        ` : ''}
                        ${currentTags.length > 1 ? `
                          <span class="chip-remove btn-remove-active-tag" data-tag="${escapeHTML(t)}" title="Remove tag">×</span>
                        ` : ''}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Add more tags to running session -->
                <div style="margin-top: 12px; display: flex; justify-content: center;">
                  <div class="inline-add-tag-form" style="position: relative; max-width: 340px; width: 100%;">
                    <input
                      type="text"
                      id="inputAddActiveTag"
                      class="m3-text-field"
                      style="height: 38px; padding: 6px 14px 6px 36px; font-size: 0.88rem; border-radius: var(--shape-corner-full);"
                      placeholder="+ Add another tag or sub-title..."
                      autocomplete="off"
                    />
                    <span class="material-symbols-rounded m3-field-icon" style="left: 10px; font-size: 18px;">add</span>
                    <div id="activeTagAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
                  </div>
                </div>
              </div>
            ` : `
              <!-- Pre-Tracking Form: Title + Tags + Tag-as-Title -->
              <div class="session-setup-card">
                <!-- 1. Session Title Field -->
                <div class="session-title-section">
                  <div class="field-label-row">
                    <span class="field-label-text">Session Title</span>
                    <span class="field-sublabel-text">Main activity you are doing</span>
                  </div>
                  <div class="m3-field-container">
                    <span class="material-symbols-rounded m3-field-icon">edit_note</span>
                    <input
                      type="text"
                      id="sessionTitleInput"
                      class="m3-text-field"
                      placeholder="Type a title (e.g. Attending class, Math Lecture)"
                      autocomplete="off"
                      value="${escapeHTML(this.sessionTitle)}"
                    />
                    <div id="titleAutocompleteDropdown" class="m3-autocomplete-panel" style="display: none;"></div>
                  </div>
                </div>

                <!-- 2. Attached Tags Section -->
                <div class="session-tags-section" style="margin-top: 16px;">
                  <div class="field-label-row">
                    <span class="field-label-text">Session Tags</span>
                    <span class="field-sublabel-text">Additional sub-activities or categories</span>
                  </div>

                  <!-- Selected Tag Chips with 'Make Title' and 'Remove' -->
                  <div class="selected-tags-strip" id="selectedTagsStrip">
                    ${Array.from(this.selectedTags).length === 0 ? `
                      <span style="font-size: 0.8rem; color: var(--md-sys-color-outline); font-style: italic; line-height: 32px;">
                        No extra tags added yet. Add tags below or click any suggestion.
                      </span>
                    ` : Array.from(this.selectedTags).map(tag => `
                      <span class="m3-chip active session-tag-chip" data-tag="${escapeHTML(tag)}">
                        <span class="material-symbols-rounded" style="font-size: 14px;">label</span>
                        <span class="tag-text">${escapeHTML(tag)}</span>
                        <button type="button" class="btn-make-tag-title" data-tag="${escapeHTML(tag)}" title="Make this tag your session title" style="background:none;border:none;color:inherit;cursor:pointer;display:inline-flex;align-items:center;margin-left:4px;opacity:0.8;">
                          <span class="material-symbols-rounded" style="font-size: 14px;">arrow_upward</span>
                        </button>
                        <span class="chip-remove btn-remove-tag" data-tag="${escapeHTML(tag)}" title="Remove tag">×</span>
                      </span>
                    `).join('')}
                  </div>

                  <!-- Tag Input Field -->
                  <div class="m3-field-container" style="margin-top: 8px;">
                    <span class="material-symbols-rounded m3-field-icon">add</span>
                    <input
                      type="text"
                      id="tagInput"
                      class="m3-text-field"
                      placeholder="+ Type a tag (e.g. Physics, Homework) and press Enter"
                      autocomplete="off"
                    />
                    <div id="tagAutocompleteDropdown" class="m3-autocomplete-panel" style="display: none;"></div>
                  </div>
                </div>

                <!-- 3. Suggestions: Click to Set as Title OR Add as Tag -->
                ${topSuggestions.length > 0 ? `
                  <div style="margin-top: 14px;">
                    <div class="quick-tags-label">Recent Activities (Click to set as Title or Tag):</div>
                    <div class="dual-suggestion-chips-grid">
                      ${topSuggestions.map(t => {
                        const name = t.displayName || t.name;
                        return `
                          <div class="suggestion-pill">
                            <button type="button" class="pill-title-action btn-quick-set-title" data-name="${escapeHTML(name)}" title="Set '${escapeHTML(name)}' as Session Title">
                              <span class="material-symbols-rounded" style="font-size: 14px;">edit</span>
                              <span>${escapeHTML(name)}</span>
                            </button>
                            <button type="button" class="pill-tag-action btn-quick-add-tag" data-name="${escapeHTML(name)}" title="Add as Tag">
                              <span class="material-symbols-rounded" style="font-size: 14px;">add</span>
                            </button>
                          </div>
                        `;
                      }).join('')}
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
                Claim Elapsed Time
              </button>
            `}
          </div>
        </div>

        <!-- Phone Screen-Time Style Daily Breakdown -->
        <div id="trackerDailyBreakdownContainer" style="margin-top: 18px;"></div>
      </section>
    `;
  }

  bindEvents() {
    const isTracking = timerService.isActive();
    const btnStart = this.container.querySelector('#btnStartTimer');
    const btnStop = this.container.querySelector('#btnStopTimer');
    const btnClaim = this.container.querySelector('#btnClaimElapsed');

    // ==================== IDLE PRE-TRACKING EVENTS ====================
    if (!isTracking) {
      const titleInput = this.container.querySelector('#sessionTitleInput');
      const titleDropdown = this.container.querySelector('#titleAutocompleteDropdown');
      const tagInput = this.container.querySelector('#tagInput');
      const tagDropdown = this.container.querySelector('#tagAutocompleteDropdown');

      // Update stored title on input
      if (titleInput) {
        titleInput.addEventListener('input', () => {
          this.sessionTitle = titleInput.value;
          this.renderAutocompleteDropdown(titleInput.value.trim(), titleDropdown, {
            onSetTitle: (val) => {
              this.sessionTitle = val;
              titleInput.value = val;
              titleDropdown.style.display = 'none';
            },
            onAddTag: (val) => {
              this.selectedTags.add(val);
              titleDropdown.style.display = 'none';
              this.render();
              this.bindEvents();
            }
          });
        });

        titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleStart();
          }
        });
      }

      // Add Tag Input Handling
      if (tagInput && tagDropdown) {
        const addTagVal = (val) => {
          const clean = (val || '').trim().replace(/^,+|,+$/g, '');
          if (clean) {
            this.selectedTags.add(clean);
            tagInput.value = '';
            tagDropdown.style.display = 'none';
            this.render();
            this.bindEvents();
            const newInput = this.container.querySelector('#tagInput');
            if (newInput) newInput.focus();
          }
        };

        tagInput.addEventListener('input', () => {
          const q = tagInput.value.trim();
          if (q.includes(',')) {
            addTagVal(tagInput.value);
            return;
          }
          this.renderAutocompleteDropdown(q, tagDropdown, {
            onSetTitle: (val) => {
              this.sessionTitle = val;
              tagInput.value = '';
              tagDropdown.style.display = 'none';
              this.render();
              this.bindEvents();
            },
            onAddTag: (val) => {
              addTagVal(val);
            }
          });
        });

        tagInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const firstItem = tagDropdown.querySelector('.autocomplete-item');
            if (firstItem && tagDropdown.style.display !== 'none') {
              addTagVal(firstItem.getAttribute('data-val'));
            } else {
              addTagVal(tagInput.value);
            }
          }
        });
      }

      // Remove a tag from selected list
      this.container.querySelectorAll('.btn-remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          this.selectedTags.delete(tag);
          this.render();
          this.bindEvents();
        });
      });

      // Promote Tag to Title ("Make a tag your title itself")
      this.container.querySelectorAll('.btn-make-tag-title').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          if (tag) {
            this.sessionTitle = tag;
            this.render();
            this.bindEvents();
          }
        });
      });

      // Quick Suggestion Pill Actions
      this.container.querySelectorAll('.btn-quick-set-title').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.getAttribute('data-name');
          if (name) {
            this.sessionTitle = name;
            this.render();
            this.bindEvents();
          }
        });
      });

      this.container.querySelectorAll('.btn-quick-add-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.getAttribute('data-name');
          if (name) {
            this.selectedTags.add(name);
            this.render();
            this.bindEvents();
          }
        });
      });

      // Start Tracking Action
      if (btnStart) {
        btnStart.addEventListener('click', () => {
          this.handleStart();
        });
      }

      // Claim Elapsed Time Action
      if (btnClaim) {
        btnClaim.addEventListener('click', () => {
          const currentTags = Array.from(this.selectedTags);
          if (this.onOpenClaimModal) {
            this.onOpenClaimModal({
              title: this.sessionTitle,
              tags: currentTags
            });
          }
        });
      }

      // Click outside dropdowns to close
      document.addEventListener('click', (e) => {
        if (titleInput && titleDropdown && !titleInput.contains(e.target) && !titleDropdown.contains(e.target)) {
          titleDropdown.style.display = 'none';
        }
        if (tagInput && tagDropdown && !tagInput.contains(e.target) && !tagDropdown.contains(e.target)) {
          tagDropdown.style.display = 'none';
        }
      });
    }

    // ==================== ACTIVE TRACKING LIVE EVENTS ====================
    if (isTracking) {
      const activeInput = this.container.querySelector('#inputAddActiveTag');
      const activeDropdown = this.container.querySelector('#activeTagAutocomplete');
      const removeActiveButtons = this.container.querySelectorAll('.btn-remove-active-tag');
      const makeTitleButtons = this.container.querySelectorAll('.btn-make-tag-title');

      // Make tag title while running
      makeTitleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          timerService.setTitleFromTag(tag);
        });
      });

      // Remove tag while running
      removeActiveButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          timerService.removeTagFromActiveSession(tag);
        });
      });

      // Add tag while running
      if (activeInput && activeDropdown) {
        activeInput.addEventListener('input', () => {
          const q = activeInput.value.trim();
          this.renderAutocompleteDropdown(q, activeDropdown, {
            onSetTitle: (val) => {
              timerService.setSessionTitle(val);
              activeInput.value = '';
              activeDropdown.style.display = 'none';
            },
            onAddTag: (val) => {
              timerService.addTagToActiveSession(val);
              activeInput.value = '';
              activeDropdown.style.display = 'none';
            }
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

    // Mount Phone Screen-Time Style Daily Breakdown
    const breakdownEl = this.container.querySelector('#trackerDailyBreakdownContainer');
    if (breakdownEl) {
      this.dailyBreakdownInstance = new DailyBreakdownView(breakdownEl, {
        onSelectActivity: (act) => {
          this.setSessionTitle(act);
        }
      });
    }
  }

  setSessionTitle(title, tag = null) {
    if (!title) return;
    this.sessionTitle = title;
    if (tag) this.selectedTags.add(tag);
    if (timerService.isActive()) {
      timerService.setSessionTitle(title);
    }
    this.render();
    this.bindEvents();
  }

  handleStart() {
    const title = this.sessionTitle.trim() || 'Attending class';
    const tagsArray = Array.from(this.selectedTags).filter(Boolean);

    // Make sure title is in tags
    if (!tagsArray.some(t => t.toLowerCase() === title.toLowerCase())) {
      tagsArray.unshift(title);
    }

    timerService.startTimer(tagsArray, null, title);
    getAllTags().then(tags => this.tagsList = tags);
  }

  renderAutocompleteDropdown(query, dropdown, callbacks) {
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

    dropdown.innerHTML = matches.slice(0, 5).map(m => {
      const name = m.displayName || m.name;
      const highlighted = highlightMatch(name, q);
      return `
        <div class="autocomplete-item dual-action-item" data-val="${escapeHTML(name)}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="font-size: 16px; color: var(--md-sys-color-primary);">label</span>
            <span>${highlighted}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="m3-button tonal btn-ac-title" data-val="${escapeHTML(name)}" style="height: 26px; padding: 0 10px; font-size: 0.72rem;">
              Set as Title
            </button>
            <button type="button" class="m3-button outlined btn-ac-tag" data-val="${escapeHTML(name)}" style="height: 26px; padding: 0 10px; font-size: 0.72rem;">
              + Tag
            </button>
          </div>
        </div>
      `;
    }).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.btn-ac-title').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onSetTitle(btn.getAttribute('data-val'));
      });
    });

    dropdown.querySelectorAll('.btn-ac-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onAddTag(btn.getAttribute('data-val'));
      });
    });

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-val');
        callbacks.onSetTitle(val);
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
