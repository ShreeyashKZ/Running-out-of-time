// History Timeline View for "Running out of time"
import { getAllSessions, deleteSession } from '../services/db.js';
import { formatTimeOfDay, formatHumanDuration, formatDateLabel } from '../services/timer.js';

export class HistoryView {
  constructor(container, onOpenManualEntry) {
    this.container = container;
    this.onOpenManualEntry = onOpenManualEntry;
    this.sessions = [];

    this.init();
  }

  async init() {
    this.sessions = await getAllSessions();
    this.render();
    this.bindEvents();
  }

  render() {
    // Group sessions by dateStr
    const grouped = new Map();
    for (const session of this.sessions) {
      const dateKey = session.dateStr || new Date(session.startTime).toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey).push(session);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    this.container.innerHTML = `
      <section class="history-view">
        <div class="view-header">
          <div class="view-title-row">
            <h2 class="view-title">Activity History</h2>
            <button class="m3-button tonal" id="btnHistoryAddManual">
              <span class="material-symbols-rounded">add</span>
              Log Past Activity
            </button>
          </div>
          <p class="view-subtitle">Chronological record of all tracked time sessions.</p>
        </div>

        ${this.sessions.length === 0 ? `
          <div class="m3-card empty-state">
            <span class="material-symbols-rounded">history_toggle_off</span>
            <h3>No tracked sessions yet</h3>
            <p style="margin-bottom: 20px; font-size: 0.9rem;">
              Your completed time sessions will be chronologically logged here.
            </p>
          </div>
        ` : `
          <div class="history-timeline">
            ${Array.from(grouped.entries()).map(([dateKey, daySessions]) => {
              let label = formatDateLabel(dateKey);
              if (dateKey === todayStr) label = `Today • ${label}`;
              else if (dateKey === yesterdayStr) label = `Yesterday • ${label}`;

              const dayTotalMs = daySessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);

              return `
                <div class="history-day-group">
                  <div class="history-day-header">
                    <span class="material-symbols-rounded" style="font-size: 20px;">calendar_today</span>
                    <span>${label}</span>
                    <span style="margin-left: auto; font-family: var(--font-family-mono); font-size: 0.85rem; color: var(--md-sys-color-outline);">
                      Total: ${formatHumanDuration(dayTotalMs)}
                    </span>
                  </div>

                  <div class="day-sessions-list">
                    ${daySessions.map(session => this.renderSessionCard(session)).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>
    `;
  }

  renderSessionCard(session) {
    const startTimeText = formatTimeOfDay(session.startTime);
    const endTimeText = formatTimeOfDay(session.endTime);
    const durationText = formatHumanDuration(session.durationMs);

    return `
      <div class="history-session-card" data-id="${session.id}">
        <div class="session-main">
          <div class="session-title">${escapeHTML(session.title)}</div>
          <div class="session-times">
            <span class="material-symbols-rounded" style="font-size: 16px;">schedule</span>
            <span>${startTimeText} – ${endTimeText}</span>
            <span>•</span>
            <span class="session-duration">${durationText}</span>
          </div>
          ${session.tags && session.tags.length > 0 ? `
            <div class="chips-container" style="margin-top: 6px;">
              ${session.tags.map(t => `<span class="m3-chip" style="font-size: 0.75rem; padding: 2px 8px;">#${escapeHTML(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <div class="session-actions">
          <button class="m3-icon-button small-btn btn-delete-session" data-id="${session.id}" title="Delete entry">
            <span class="material-symbols-rounded" style="color: var(--md-sys-color-error); font-size: 18px;">delete</span>
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const btnAdd = this.container.querySelector('#btnHistoryAddManual');
    if (btnAdd && this.onOpenManualEntry) {
      btnAdd.addEventListener('click', () => this.onOpenManualEntry());
    }

    const deleteButtons = this.container.querySelectorAll('.btn-delete-session');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this tracked session?')) {
          await deleteSession(id);
          this.init();
        }
      });
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
