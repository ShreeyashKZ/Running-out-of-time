// Claim Elapsed Time & Past Activity Multi-Tag Logging Modal for "Running out of time"
import { addSession, getAllTags } from '../services/db.js';
import { formatHumanDuration, timerService } from '../services/timer.js';

export class ManualEntryModal {
  constructor(modalContainer, onSaved, options = {}) {
    this.modalContainer = modalContainer;
    this.onSaved = onSaved;
    this.options = options;
    this.tagsList = [];

    // Initialize tags set from options
    let initialTags = ['Attending class'];
    if (options.tags && Array.isArray(options.tags) && options.tags.length > 0) {
      initialTags = options.tags;
    } else if (options.title) {
      initialTags = [options.title];
    }
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

    this.modalContainer.innerHTML = `
      <div class="m3-dialog">
        <div class="dialog-header">
          <div>
            <h3 class="dialog-title">${modalTitle}</h3>
            <p style="font-size: 0.82rem; color: var(--md-sys-color-outline); margin-top: 2px;">
              Select the day, time, and attach multiple activity titles/tags to this single session.
            </p>
          </div>
          <button class="m3-icon-button" id="btnManualClose">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <form id="manualEntryForm">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Multi-Tag / Multi-Title Selector -->
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Session Activities / Titles (Multiple Allowed)
              </label>

              <!-- Selected Tags Strip -->
              <div class="chips-container" id="modalSelectedTags" style="margin-bottom: 8px;">
                ${Array.from(this.selectedTags).map(t => `
                  <span class="m3-chip active modal-tag-chip" data-tag="${escapeHTML(t)}">
                    <span class="material-symbols-rounded" style="font-size: 15px;">label</span>
                    ${escapeHTML(t)}
                    <span class="chip-remove btn-modal-remove-tag" data-tag="${escapeHTML(t)}" title="Remove">×</span>
                  </span>
                `).join('')}
              </div>

              <!-- Input for typing more tags with autocomplete -->
              <div class="m3-field-container">
                <span class="material-symbols-rounded m3-field-icon">new_label</span>
                <input
                  type="text"
                  id="modalTagInput"
                  class="m3-text-field"
                  placeholder="Type an activity (e.g. Attending class, Math) and press Enter"
                  autocomplete="off"
                />
                <div id="modalAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
              </div>
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
    const tagInput = this.modalContainer.querySelector('#modalTagInput');
    const dropdown = this.modalContainer.querySelector('#modalAutocomplete');
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
      if (endMin < startMin) endMin += 24 * 60; // Crosses midnight

      const diffMs = (endMin - startMin) * 60 * 1000;
      preview.textContent = formatHumanDuration(diffMs);
    };

    inputStart.addEventListener('change', updateDuration);
    inputEnd.addEventListener('change', updateDuration);
    updateDuration();

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

    const addTag = (tag) => {
      const clean = (tag || '').trim().replace(/^,+|,+$/g, '');
      if (clean) {
        this.selectedTags.add(clean);
        this.render();
        this.bindEvents();
        const newInput = this.modalContainer.querySelector('#modalTagInput');
        if (newInput) newInput.focus();
      }
    };

    if (tagInput && dropdown) {
      tagInput.addEventListener('input', () => {
        const q = tagInput.value.trim().toLowerCase();
        if (q.includes(',')) {
          addTag(tagInput.value);
          return;
        }
        if (!q) {
          dropdown.style.display = 'none';
          return;
        }

        const matches = this.tagsList.filter(t => (t.displayName || t.name).toLowerCase().includes(q));
        if (matches.length === 0) {
          dropdown.style.display = 'none';
          return;
        }

        dropdown.innerHTML = matches.slice(0, 5).map(m => `
          <div class="autocomplete-item" data-val="${escapeHTML(m.displayName || m.name)}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="material-symbols-rounded" style="font-size: 16px; color: var(--md-sys-color-primary);">label</span>
              <span>${escapeHTML(m.displayName || m.name)}</span>
            </div>
            <span style="font-size: 0.75rem; color: var(--md-sys-color-outline);">${m.useCount > 1 ? `${m.useCount}x` : ''}</span>
          </div>
        `).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            addTag(item.getAttribute('data-val'));
          });
        });
      });

      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const firstItem = dropdown.querySelector('.autocomplete-item');
          if (firstItem && dropdown.style.display !== 'none') {
            addTag(firstItem.getAttribute('data-val'));
          } else {
            addTag(tagInput.value);
          }
        }
      });

      document.addEventListener('click', (e) => {
        if (!tagInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    }

    btnClose.addEventListener('click', () => this.close());
    btnCancel.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (tagInput && tagInput.value.trim()) {
        this.selectedTags.add(tagInput.value.trim());
      }

      const tagsArray = Array.from(this.selectedTags).filter(Boolean);
      const finalTags = tagsArray.length > 0 ? tagsArray : ['Attending class'];
      const title = finalTags.join(' • ');

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
        tags: finalTags,
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
