// Data Management & Backup Modal for "Running out of time"
import { exportAllData, importData, populateSampleData, clearAllData, getAllSessions } from '../services/db.js';

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
          <h3 class="dialog-title">Data & Backup</h3>
          <button class="m3-icon-button" id="btnDataClose">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <p style="font-size: 0.9rem; color: var(--md-sys-color-outline); margin-bottom: 20px;">
          All your time data is stored strictly in your browser and device. You can export, restore, or generate sample stats.
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Export JSON -->
          <button class="m3-button tonal" id="btnExportJSON" style="justify-content: flex-start; height: 50px;">
            <span class="material-symbols-rounded">file_download</span>
            <div style="text-align: left; margin-left: 6px;">
              <div style="font-weight: 700;">Export JSON Backup</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Full backup including tags and sessions</div>
            </div>
          </button>

          <!-- Export CSV -->
          <button class="m3-button tonal" id="btnExportCSV" style="justify-content: flex-start; height: 50px;">
            <span class="material-symbols-rounded">table_chart</span>
            <div style="text-align: left; margin-left: 6px;">
              <div style="font-weight: 700;">Export CSV for Excel / Sheets</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Spreadsheet format with dates and durations</div>
            </div>
          </button>

          <!-- Import JSON -->
          <label class="m3-button tonal" style="justify-content: flex-start; height: 50px; cursor: pointer;">
            <span class="material-symbols-rounded">file_upload</span>
            <div style="text-align: left; margin-left: 6px;">
              <div style="font-weight: 700;">Import Backup</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Restore from previous JSON file</div>
            </div>
            <input type="file" id="importFileInput" accept=".json" style="display: none;" />
          </label>

          <hr style="border: 0; border-top: 1px solid var(--md-sys-color-outline-variant); margin: 6px 0;" />

          <!-- Populate Demo Data -->
          <button class="m3-button outlined" id="btnLoadSampleData" style="justify-content: flex-start; height: 48px;">
            <span class="material-symbols-rounded">auto_awesome</span>
            <div style="text-align: left; margin-left: 6px;">
              <div style="font-weight: 700;">Load Realistic Sample Data</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline);">Populate 2 weeks of sample stats & leaderboard</div>
            </div>
          </button>

          <!-- Clear All Data -->
          <button class="m3-button error" id="btnClearData" style="justify-content: flex-start; height: 48px; margin-top: 4px;">
            <span class="material-symbols-rounded">delete_forever</span>
            <div style="text-align: left; margin-left: 6px;">
              <div style="font-weight: 700;">Clear All Data</div>
              <div style="font-size: 0.75rem; opacity: 0.85;">Erase all logged sessions and start fresh</div>
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

    btnClose.addEventListener('click', () => this.close());

    // Export JSON
    btnExportJSON.addEventListener('click', async () => {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadFile(blob, `running_out_of_time_backup_${new Date().toISOString().split('T')[0]}.json`);
    });

    // Export CSV
    btnExportCSV.addEventListener('click', async () => {
      const sessions = await getAllSessions();
      let csv = 'ID,Date,Activity,StartTime,EndTime,DurationMinutes,DurationFormatted,Tags,Notes\n';
      for (const s of sessions) {
        const startStr = new Date(s.startTime).toLocaleTimeString();
        const endStr = new Date(s.endTime).toLocaleTimeString();
        const mins = Math.round((s.durationMs / 60000) * 10) / 10;
        const tags = (s.tags || []).join(';');
        csv += `"${s.id}","${s.dateStr}","${s.title}","${startStr}","${endStr}",${mins},"${s.durationMs}ms","${tags}","${s.notes || ''}"\n`;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      downloadFile(blob, `running_out_of_time_data_${new Date().toISOString().split('T')[0]}.csv`);
    });

    // Import JSON
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

    // Load Sample Data
    btnSample.addEventListener('click', async () => {
      if (confirm('Load sample activities for the past 14 days? This lets you test the weekly/monthly/custom leaderboard and charts.')) {
        await populateSampleData();
        this.close();
        if (this.onDataChanged) this.onDataChanged();
      }
    });

    // Clear All
    btnClear.addEventListener('click', async () => {
      if (confirm('Are you sure you want to permanently delete ALL sessions and tags? This cannot be undone.')) {
        await clearAllData();
        this.close();
        if (this.onDataChanged) this.onDataChanged();
      }
    });
  }
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
