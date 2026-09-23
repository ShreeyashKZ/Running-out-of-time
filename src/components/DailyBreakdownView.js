// Daily Screen-Time Style Activity Breakdown Component for "Root"
import { getAllSessions } from '../services/db.js';
import { formatHumanDuration } from '../services/timer.js';

// Curated harmonious colors for the segmented screen-time bar
const BREAKDOWN_COLORS = [
  '#2D7DD2', // Vibrant Blue
  '#00A896', // Emerald Teal
  '#F08A5D', // Coral Amber
  '#9B5DE5', // Purple Amethyst
  '#F15BB5', // Rose Pink
  '#00BBF9', // Sky Cyan
  '#FEE440', // Golden Sun
  '#48CAE4', // Soft Azure
  '#80B918', // Leaf Green
  '#E76F51'  // Terracotta
];

export class DailyBreakdownView {
  constructor(container, options = {}) {
    this.container = container;
    this.onSelectActivity = options.onSelectActivity || (() => {});
    this.selectedDateStr = options.dateStr || new Date().toISOString().split('T')[0];
    this.sessions = [];
    this.dayStats = null;

    this.init();
  }

  async init() {
    this.sessions = await getAllSessions();
    this.computeDayStats();
    this.render();
    this.bindEvents();
  }

  setDate(dateStr) {
    this.selectedDateStr = dateStr;
    this.computeDayStats();
    this.render();
    this.bindEvents();
  }

  computeDayStats() {
    // Filter sessions matching this day
    const daySessions = this.sessions.filter(s => {
      const sDate = s.dateStr || new Date(s.startTime).toISOString().split('T')[0];
      return sDate === this.selectedDateStr;
    });

    const totalDurationMs = daySessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);

    // Aggregate by activity title/tag
    const activityMap = new Map();
    for (const session of daySessions) {
      const title = (session.title || 'Untitled').trim();
      const tags = Array.isArray(session.tags) && session.tags.length > 0 ? session.tags : [title];

      // Primary key: title
      if (!activityMap.has(title)) {
        activityMap.set(title, {
          title,
          tags,
          totalMs: 0,
          sessionCount: 0
        });
      }
      const entry = activityMap.get(title);
      entry.totalMs += (session.durationMs || 0);
      entry.sessionCount += 1;
    }

    // Sort descending by duration
    const ranked = Array.from(activityMap.values())
      .sort((a, b) => b.totalMs - a.totalMs)
      .map((item, index) => {
        const percentOfLogged = totalDurationMs > 0 ? Math.round((item.totalMs / totalDurationMs) * 100) : 0;
        return {
          ...item,
          color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
          percentOfLogged
        };
      });

    const dayPercent = Math.round((totalDurationMs / 86400000) * 100);

    this.dayStats = {
      dateStr: this.selectedDateStr,
      totalDurationMs,
      totalSessions: daySessions.length,
      dayPercent,
      activities: ranked
    };
  }

  render() {
    const { dateStr, totalDurationMs, totalSessions, dayPercent, activities } = this.dayStats;

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = dateStr === todayStr;

    // Date formatting
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    this.container.innerHTML = `
      <div class="m3-card daily-breakdown-card">
        <!-- Date Selector Header (Screen Time Style) -->
        <div class="daily-header-row">
          <div class="daily-title-group">
            <span class="material-symbols-rounded daily-icon">donut_small</span>
            <span class="daily-header-title">Daily Activity Breakdown</span>
          </div>

          <div class="daily-date-navigator">
            <button type="button" class="m3-icon-button small-btn" id="btnPrevDay" title="Previous day">
              <span class="material-symbols-rounded" style="font-size: 18px;">chevron_left</span>
            </button>
            <span class="daily-current-date-label ${isToday ? 'is-today' : ''}" id="dailyDateLabel">
              ${isToday ? `Today (${formattedDate})` : formattedDate}
            </span>
            <button type="button" class="m3-icon-button small-btn" id="btnNextDay" ${isToday ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} title="Next day">
              <span class="material-symbols-rounded" style="font-size: 18px;">chevron_right</span>
            </button>
          </div>
        </div>

        <!-- Hero Screen Time Metric -->
        <div class="screentime-hero">
          <div class="screentime-time-readout">
            ${totalDurationMs === 0 ? '0h 0m' : formatHumanDuration(totalDurationMs)}
          </div>
          <div class="screentime-subtext">
            <span>Total logged time</span>
            <span>•</span>
            <span>${totalSessions} session${totalSessions === 1 ? '' : 's'}</span>
            <span>•</span>
            <span>${dayPercent}% of 24h</span>
          </div>
        </div>

        <!-- Segmented Screen Time Bar (like Android Digital Wellbeing / iOS Screen Time) -->
        ${totalDurationMs > 0 ? `
          <div class="screentime-segmented-bar" title="Proportional time breakdown for this day">
            ${activities.map(act => `
              <div 
                class="screentime-segment" 
                style="width: ${Math.max(act.percentOfLogged, 2)}%; background-color: ${act.color};"
                title="${escapeHTML(act.title)}: ${formatHumanDuration(act.totalMs)} (${act.percentOfLogged}%)"
              ></div>
            `).join('')}
          </div>
        ` : `
          <div class="screentime-segmented-bar empty">
            <div class="screentime-segment empty-segment" style="width: 100%;"></div>
          </div>
        `}

        <!-- Ranked Activity List -->
        <div class="screentime-activities-list">
          ${activities.length === 0 ? `
            <div class="screentime-empty-hint">
              <span class="material-symbols-rounded" style="font-size: 28px; opacity: 0.5;">hourglass_disabled</span>
              <span>No time sessions recorded for this date.</span>
            </div>
          ` : activities.map(act => `
            <div class="screentime-item-row" data-activity="${escapeHTML(act.title)}">
              <div class="screentime-item-lead">
                <span class="activity-color-dot" style="background-color: ${act.color};"></span>
                <div class="activity-name-col">
                  <span class="activity-name-text">${escapeHTML(act.title)}</span>
                  <div class="activity-tags-subtext">
                    ${act.tags.map(t => `#${escapeHTML(t)}`).join(' ')}
                  </div>
                </div>
              </div>

              <div class="screentime-item-meter">
                <div class="meter-bar-track">
                  <div class="meter-bar-fill" style="width: ${act.percentOfLogged}%; background-color: ${act.color};"></div>
                </div>
              </div>

              <div class="screentime-item-meta">
                <span class="activity-duration-text">${formatHumanDuration(act.totalMs)}</span>
                <span class="activity-percent-badge">${act.percentOfLogged}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const btnPrev = this.container.querySelector('#btnPrevDay');
    const btnNext = this.container.querySelector('#btnNextDay');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const [y, m, d] = this.selectedDateStr.split('-').map(Number);
        const prev = new Date(y, m - 1, d - 1);
        this.setDate(prev.toISOString().split('T')[0]);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const [y, m, d] = this.selectedDateStr.split('-').map(Number);
        const next = new Date(y, m - 1, d + 1);
        const todayStr = new Date().toISOString().split('T')[0];
        if (next.toISOString().split('T')[0] <= todayStr) {
          this.setDate(next.toISOString().split('T')[0]);
        }
      });
    }

    // Clicking an activity row triggers optional selection
    this.container.querySelectorAll('.screentime-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.activity;
        if (name) this.onSelectActivity(name);
      });
    });
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
