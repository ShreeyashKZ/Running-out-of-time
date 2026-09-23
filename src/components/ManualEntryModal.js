// Claim Elapsed Time & Past Activity Multi-Tag Logging Modal for "Running out of time"
import { addSession, getAllTags } from '../services/db.js';
import { formatHumanDuration, timerService } from '../services/timer.js';

export class ManualEntryModal {
  constructor(modalContainer, onSaved, options = {}) {
    this.modalContainer = modalContainer;
    this.onSaved = onSaved;
    this.options = options;
    this.tagsList = [];

    // Title and tags setup
    let initialTitle = 'Attending class';
    let initialTags = [];

    if (typeof options === 'object') {
      if (options.title) initialTitle = options.title;
      if (Array.isArray(options.tags)) initialTags = options.tags.filter(t => t !== initialTitle);
    }

    this.sessionTitle = initialTitle;
    this.selectedTags = new Set(initialTags);

    this.init();
  }

  async init() {
    this.tagsList = await getAllTags();
    this.render();
    this.bindEvents();
    this.modalContainer.style.display = 'flex';
  }

  close() {
    this.modalContainer.style.display = 'none';
    this.modalContainer.innerHTML = '';
  }

  render() {
    const suggested = timerService.getSuggestedClaimTimes();
    const defaultDate = this.options.date || suggested.dateStr;
    const defaultStart = this.options.startTime || suggested.startTimeStr;
    const defaultEnd = this.options.endTime || suggested.endTimeStr;
    const modalTitle = this.options.isClaimMode 
      ? 'Claim Elapsed Time' 
      : 'Log Past Activity';

    const topSuggestions = this.tagsList.slice(0, 6);

    this.modalContainer.innerHTML = `
      <div class="m3-dialog" style="max-height: 90vh; overflow-y: auto;">
        <div class="dialog-header">
          <div>
            <h3 class="dialog-title">${modalTitle}</h3>
            <p style="font-size: 0.82rem; color: var(--md-sys-color-outline); margin-top: 2px;">
              Specify your session title, attach tags, or turn any tag into your title.
            </p>
          </div>
          <button class="m3-icon-button" id="btnManualClose">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <form id="manualEntryForm">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- 1. Session Title -->
            <div class="session-title-section">
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Session Title
              </label>
              <div class="m3-field-container">
                <span class="material-symbols-rounded m3-field-icon">edit_note</span>
                <input
                  type="text"
                  id="modalSessionTitle"
                  class="m3-text-field"
                  placeholder="e.g. Attending class, Math Lecture"
                  required
                  autocomplete="off"
                  value="${escapeHTML(this.sessionTitle)}"
                />
                <div id="modalTitleAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
              </div>
            </div>

            <!-- 2. Attached Tags -->
            <div class="session-tags-section">
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Attached Tags (Sub-activities)
              </label>

              <!-- Selected Tags Strip with Make Title & Remove -->
              <div class="chips-container" id="modalSelectedTags" style="margin-bottom: 8px;">
                ${Array.from(this.selectedTags).length === 0 ? `
                  <span style="font-size: 0.78rem; color: var(--md-sys-color-outline); font-style: italic;">
                    No additional tags added yet.
                  </span>
                ` : Array.from(this.selectedTags).map(t => `
                  <span class="m3-chip active modal-tag-chip" data-tag="${escapeHTML(t)}">
                    <span class="material-symbols-rounded" style="font-size: 14px;">label</span>
                    <span>${escapeHTML(t)}</span>
                    <button type="button" class="btn-modal-make-title" data-tag="${escapeHTML(t)}" title="Make this tag the title" style="background:none;border:none;color:inherit;cursor:pointer;display:inline-flex;align-items:center;margin-left:4px;opacity:0.8;">
                      <span class="material-symbols-rounded" style="font-size: 14px;">arrow_upward</span>
                    </button>
                    <span class="chip-remove btn-modal-remove-tag" data-tag="${escapeHTML(t)}" title="Remove tag">×</span>
                  </span>
                `).join('')}
              </div>

              <!-- Input for typing more tags -->
              <div class="m3-field-container">
                <span class="material-symbols-rounded m3-field-icon">add</span>
                <input
                  type="text"
                  id="modalTagInput"
                  class="m3-text-field"
                  placeholder="+ Type a tag and press Enter"
                  autocomplete="off"
                />
                <div id="modalTagAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
              </div>

              <!-- Quick suggestions -->
              ${topSuggestions.length > 0 ? `
                <div style="margin-top: 10px;">
                  <div class="quick-tags-label" style="font-size: 0.75rem;">Click to use as Title or add as Tag:</div>
                  <div class="dual-suggestion-chips-grid">
                    ${topSuggestions.map(t => {
                      const name = t.displayName || t.name;
                      return `
                        <div class="suggestion-pill">
                          <button type="button" class="pill-title-action btn-modal-set-title" data-name="${escapeHTML(name)}" title="Set as Title">
                            <span class="material-symbols-rounded" style="font-size: 13px;">edit</span>
                            <span>${escapeHTML(name)}</span>
                          </button>
                          <button type="button" class="pill-tag-action btn-modal-add-tag" data-name="${escapeHTML(name)}" title="Add as Tag">
                            <span class="material-symbols-rounded" style="font-size: 13px;">add</span>
                          </button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Day / Date Selection -->
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Day
              </label>
              <input type="date" id="manualDate" class="m3-text-field" style="padding-left: 16px;" value="${defaultDate}" required />
            </div>

            <!-- Start Time & End Time Selection -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                  Start Time
                </label>
                <input type="time" id="manualStartTime" class="m3-text-field" style="padding-left: 16px;" value="${defaultStart}" required />
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                  End Time
                </label>
                <input type="time" id="manualEndTime" class="m3-text-field" style="padding-left: 16px;" value="${defaultEnd}" required />
              </div>
            </div>

            <!-- Calculated Duration Preview -->
            <div style="background-color: var(--md-sys-color-surface-container); padding: 12px 16px; border-radius: var(--shape-corner-md); display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--md-sys-color-outline-variant);">
              <span style="font-size: 0.85rem; color: var(--md-sys-color-outline);">Duration to Record:</span>
              <span id="manualDurationPreview" style="font-family: var(--font-family-mono); font-weight: 700; color: var(--md-sys-color-primary);">
                --
              </span>
            </div>
          </div>

          <div class="dialog-footer">
            <button type="button" class="m3-button text" id="btnManualCancel">Cancel</button>
            <button type="submit" class="m3-button filled">
              <span class="material-symbols-rounded">save</span>
              Save Activity Log
            </button>
          </div>
        </form>
      </div>
    `;
  }

  bindEvents() {
    const form = this.modalContainer.querySelector('#manualEntryForm');
    const btnClose = this.modalContainer.querySelector('#btnManualClose');
    const btnCancel = this.modalContainer.querySelector('#btnManualCancel');
    const titleInput = this.modalContainer.querySelector('#modalSessionTitle');
    const tagInput = this.modalContainer.querySelector('#modalTagInput');
    const inputDate = this.modalContainer.querySelector('#manualDate');
    const inputStart = this.modalContainer.querySelector('#manualStartTime');
    const inputEnd = this.modalContainer.querySelector('#manualEndTime');
    const preview = this.modalContainer.querySelector('#manualDurationPreview');

    const updateDuration = () => {
      const startVal = inputStart.value;
      const endVal = inputEnd.value;
      if (!startVal || !endVal) return;

      const [sh, sm] = startVal.split(':').map(Number);
      const [eh, em] = endVal.split(':').map(Number);

      let startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if (endMin < startMin) endMin += 24 * 60;

      const diffMs = (endMin - startMin) * 60 * 1000;
      preview.textContent = formatHumanDuration(diffMs);
    };

    inputStart.addEventListener('change', updateDuration);
    inputEnd.addEventListener('change', updateDuration);
    updateDuration();

    if (titleInput) {
      titleInput.addEventListener('input', () => {
        this.sessionTitle = titleInput.value;
      });
    }

    // Make Tag the Title inside Modal
    this.modalContainer.querySelectorAll('.btn-modal-make-title').forEach(btn => {
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

    // Remove Tag Handlers
    this.modalContainer.querySelectorAll('.btn-modal-remove-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = btn.getAttribute('data-tag');
        this.selectedTags.delete(t);
        this.render();
        this.bindEvents();
      });
    });

    // Quick Suggestion actions
    this.modalContainer.querySelectorAll('.btn-modal-set-title').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (name) {
          this.sessionTitle = name;
          this.render();
          this.bindEvents();
        }
      });
    });

    this.modalContainer.querySelectorAll('.btn-modal-add-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (name) {
          this.selectedTags.add(name);
          this.render();
          this.bindEvents();
        }
      });
    });

    // Tag input on Enter
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const clean = tagInput.value.trim().replace(/^,+|,+$/g, '');
          if (clean) {
            this.selectedTags.add(clean);
            this.render();
            this.bindEvents();
          }
        }
      });
    }

    btnClose.addEventListener('click', () => this.close());
    btnCancel.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = this.sessionTitle.trim() || 'Attending class';
      const tagsArray = Array.from(this.selectedTags).filter(Boolean);

      if (!tagsArray.some(t => t.toLowerCase() === title.toLowerCase())) {
        tagsArray.unshift(title);
      }

      const dateStr = inputDate.value;
      const [sh, sm] = inputStart.value.split(':').map(Number);
      const [eh, em] = inputEnd.value.split(':').map(Number);

      const startDate = new Date(`${dateStr}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);
      const endDate = new Date(`${dateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`);

      let startTime = startDate.getTime();
      let endTime = endDate.getTime();
      if (endTime < startTime) {
        endTime += 24 * 3600 * 1000;
      }
      const durationMs = Math.max(0, endTime - startTime);

      const session = {
        title,
        tags: tagsArray,
        startTime,
        endTime,
        durationMs,
        dateStr,
        notes: this.options.isClaimMode ? 'Claimed elapsed time' : 'Manually logged'
      };

      await addSession(session);
      this.close();
      if (this.onSaved) this.onSaved(session);
    });
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
