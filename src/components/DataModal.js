// Data Management & Interoperability Modal for "Root"
import { exportAllData, exportSessionsCSV, shareOrDownloadData, importData, populateSampleData, clearAllData } from '../services/db.js';

export class DataModal {
  constructor(modalContainer, onDataChanged) {
    this.modalContainer = modalContainer;
    this.onDataChanged = onDataChanged;

    this.render();
    this.bindEvents();
    this.modalContainer.style.display = 'flex';
  }

  close() {
    this.modalContainer.style.display = 'none';
    this.modalContainer.innerHTML = '';
  }

  render() {
    this.modalContainer.innerHTML = `
      <div class="m3-dialog">
        <div class="dialog-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary);">database</span>
            <h3 class="dialog-title" style="margin: 0;">Data & Interoperability</h3>
          </div>
          <button class="m3-icon-button" id="btnDataClose" title="Close" aria-label="Close dialog">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <p style="font-size: 0.88rem; color: var(--md-sys-color-outline); margin-bottom: 18px; line-height: 1.4;">
          Your data is stored 100% locally on your device in standard open formats. You can share or export it for use in other apps, spreadsheets, or data tools.
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Share / Export JSON -->
          <button class="m3-button tonal" id="btnExportJSON" style="justify-content: flex-start; height: 50px; text-align: left; padding: 0 16px;">
            <span class="material-symbols-rounded" style="font-size: 22px;">code</span>
            <div style="margin-left: 10px; flex: 1;">
              <div style="font-weight: 700; font-size: 0.9rem;">Export / Share JSON</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Standard JSON schema (Sessions, Todos, Tags)</div>
            </div>
            <span class="material-symbols-rounded" style="font-size: 18px; opacity: 0.6;">share</span>
          </button>

          <!-- Share / Export CSV -->
          <button class="m3-button tonal" id="btnExportCSV" style="justify-content: flex-start; height: 50px; text-align: left; padding: 0 16px;">
            <span class="material-symbols-rounded" style="font-size: 22px;">table_chart</span>
            <div style="margin-left: 10px; flex: 1;">
              <div style="font-weight: 700; font-size: 0.9rem;">Export / Share CSV (Excel / Sheets)</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Universal RFC 4180 spreadsheet format</div>
            </div>
            <span class="material-symbols-rounded" style="font-size: 18px; opacity: 0.6;">share</span>
          </button>

          <!-- Import Backup -->
          <label class="m3-button tonal" style="justify-content: flex-start; height: 50px; text-align: left; padding: 0 16px; cursor: pointer;">
            <span class="material-symbols-rounded" style="font-size: 22px;">file_upload</span>
            <div style="margin-left: 10px; flex: 1;">
              <div style="font-weight: 700; font-size: 0.9rem;">Import Backup File</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Restore data from standard JSON backup</div>
            </div>
            <input type="file" id="importFileInput" accept=".json" style="display: none;" />
          </label>

          <hr style="border: 0; border-top: 1px solid var(--md-sys-color-outline-variant); margin: 6px 0;" />

          <!-- Populate Demo Data -->
          <button class="m3-button outlined" id="btnLoadSampleData" style="justify-content: flex-start; height: 46px; text-align: left; padding: 0 16px;">
            <span class="material-symbols-rounded" style="font-size: 20px;">dataset</span>
            <div style="margin-left: 10px; flex: 1;">
              <div style="font-weight: 700; font-size: 0.88rem;">Load Sample Dataset</div>
              <div style="font-size: 0.72rem; color: var(--md-sys-color-outline);">Populate 14 days of realistic logs & leaderboards</div>
            </div>
          </button>

          <!-- Clear All Data -->
          <button class="m3-button error" id="btnClearData" style="justify-content: flex-start; height: 46px; text-align: left; padding: 0 16px; margin-top: 2px;">
            <span class="material-symbols-rounded" style="font-size: 20px;">delete_forever</span>
            <div style="margin-left: 10px; flex: 1;">
              <div style="font-weight: 700; font-size: 0.88rem;">Erase All Data</div>
              <div style="font-size: 0.72rem; opacity: 0.9;">Permanently delete all sessions, todos & tags</div>
            </div>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const btnClose = this.modalContainer.querySelector('#btnDataClose');
    const btnExportJSON = this.modalContainer.querySelector('#btnExportJSON');
    const btnExportCSV = this.modalContainer.querySelector('#btnExportCSV');
    const fileInput = this.modalContainer.querySelector('#importFileInput');
    const btnSample = this.modalContainer.querySelector('#btnLoadSampleData');
    const btnClear = this.modalContainer.querySelector('#btnClearData');

    if (btnClose) btnClose.addEventListener('click', () => this.close());

    // Export / Share JSON
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', async () => {
        await shareOrDownloadData('json');
      });
    }

    // Export / Share CSV
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', async () => {
        await shareOrDownloadData('csv');
      });
    }

    // Import JSON
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          await importData(json);
          alert('Data imported successfully!');
          this.close();
          if (this.onDataChanged) this.onDataChanged();
        } catch (err) {
          alert('Failed to import file: ' + err.message);
        }
      });
    }

    // Load Sample Data
    if (btnSample) {
      btnSample.addEventListener('click', async () => {
        if (confirm('Load sample activities for the past 14 days? This populates stats, charts, and leaderboards.')) {
          await populateSampleData();
          this.close();
          if (this.onDataChanged) this.onDataChanged();
        }
      });
    }

    // Clear All
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        if (confirm('Permanently delete all logged sessions, todos, and tags? This cannot be undone.')) {
          await clearAllData();
          this.close();
          if (this.onDataChanged) this.onDataChanged();
        }
      });
    }
  }
}
