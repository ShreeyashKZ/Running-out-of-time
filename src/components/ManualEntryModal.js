// Manual Activity Logging Modal for "Running out of time"
import { addSession, getAllTags } from '../services/db.js';
import { formatHumanDuration } from '../services/timer.js';

export class ManualEntryModal {
  constructor(modalContainer, onSaved) {
    this.modalContainer = modalContainer;
    this.onSaved = onSaved;
    this.tagsList = [];

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
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultStart = '12:25';
    const defaultEnd = '15:30';

    this.modalContainer.innerHTML = `
      <div class="m3-dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">Log Past Activity</h3>
          <button class="m3-icon-button" id="btnManualClose">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <form id="manualEntryForm">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Activity Title -->
            <div class="m3-field-container">
              <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Activity Name
              </label>
              <span class="material-symbols-rounded m3-field-icon" style="top: 38px;">edit_note</span>
              <input
                type="text"
                id="manualTitle"
                class="m3-text-field"
                placeholder="e.g. Attending class"
                required
                autocomplete="off"
              />
              <div id="manualAutocomplete" class="m3-autocomplete-panel" style="display: none;"></div>
            </div>

            <!-- Date -->
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                Date
              </label>
              <input type="date" id="manualDate" class="m3-text-field" style="padding-left: 16px;" value="${todayStr}" required />
            </div>

            <!-- Start Time & End Time -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                  Start Time
                </label>
                <input type="time" id="manualStartTime" class="m3-text-field" style="padding-left: 16px;" value="${defaultStart}" required />
              </div>
              <div>
                <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--md-sys-color-outline);">
                  End Time
                </label>
                <input type="time" id="manualEndTime" class="m3-text-field" style="padding-left: 16px;" value="${defaultEnd}" required />
              </div>
            </div>

            <!-- Duration preview -->
            <div style="background-color: var(--md-sys-color-surface-container); padding: 12px 16px; border-radius: var(--shape-corner-md); display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.85rem; color: var(--md-sys-color-outline);">Calculated Duration:</span>
              <span id="manualDurationPreview" style="font-family: var(--font-family-mono); font-weight: 700; color: var(--md-sys-color-primary);">
                3 hours 5 minutes
              </span>
            </div>
          </div>

          <div class="dialog-footer">
            <button type="button" class="m3-button text" id="btnManualCancel">Cancel</button>
            <button type="submit" class="m3-button filled">
              <span class="material-symbols-rounded">check</span>
              Save Activity
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
    const inputTitle = this.modalContainer.querySelector('#manualTitle');
    const dropdown = this.modalContainer.querySelector('#manualAutocomplete');
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

    // Autocomplete on title
    inputTitle.addEventListener('input', () => {
      const q = inputTitle.value.trim().toLowerCase();
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
          <span>${escapeHTML(m.displayName || m.name)}</span>
        </div>
      `).join('');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          inputTitle.value = item.getAttribute('data-val');
          dropdown.style.display = 'none';
        });
      });
    });

    btnClose.addEventListener('click', () => this.close());
    btnCancel.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = inputTitle.value.trim();
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
        tags: [title.toLowerCase()],
        startTime,
        endTime,
        durationMs,
        dateStr,
        notes: 'Manually logged'
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
