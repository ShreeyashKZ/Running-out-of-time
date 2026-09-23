// Leaderboard View Component for "Running out of time"
import { getAnalyticsData, PERIOD_TYPES } from '../services/analytics.js';
import { populateSampleData } from '../services/db.js';

export class LeaderboardView {
  constructor(container, onNavigateToTracker) {
    this.container = container;
    this.onNavigateToTracker = onNavigateToTracker;
    this.currentPeriod = PERIOD_TYPES.WEEKLY;
    this.customRange = {
      start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    };
    this.data = null;

    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
    this.bindEvents();
  }

  async loadData() {
    this.data = await getAnalyticsData(this.currentPeriod, this.customRange);
  }

  render() {
    const { periodType, range, totalTimeFormatted, totalSessions, dailyAverageFormatted, leaderboard } = this.data;
    const topThree = leaderboard.slice(0, 3);
    const remainingItems = leaderboard.slice(3);

    this.container.innerHTML = `
      <section class="leaderboard-view">
        <!-- View Header -->
        <div class="view-header">
          <div class="view-title-row">
            <h2 class="view-title">Time Leaderboard</h2>
            <span class="m3-chip active">
              <span class="material-symbols-rounded" style="font-size: 16px;">verified</span>
              ${escapeHTML(range.label)}
            </span>
          </div>
          <p class="view-subtitle">Ranked breakdown of where your time is being spent.</p>
        </div>

        <!-- M3 Segmented Period Selector -->
        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
          <div class="m3-segmented-group" id="periodSegmentedGroup">
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.WEEKLY ? 'active' : ''}" data-period="${PERIOD_TYPES.WEEKLY}">
              <span class="material-symbols-rounded">view_week</span>
              Weekly
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.MONTHLY ? 'active' : ''}" data-period="${PERIOD_TYPES.MONTHLY}">
              <span class="material-symbols-rounded">calendar_month</span>
              Monthly
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.ALL_TIME ? 'active' : ''}" data-period="${PERIOD_TYPES.ALL_TIME}">
              <span class="material-symbols-rounded">all_inclusive</span>
              All-Time
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.CUSTOM ? 'active' : ''}" data-period="${PERIOD_TYPES.CUSTOM}">
              <span class="material-symbols-rounded">date_range</span>
              Custom Period
            </button>
          </div>
        </div>

        <!-- Custom Date Range Picker (shown when Custom is active) -->
        ${periodType === PERIOD_TYPES.CUSTOM ? `
          <div class="custom-range-card">
            <div class="date-input-group">
              <label for="customStartDate">From:</label>
              <input type="date" id="customStartDate" class="m3-date-input" value="${this.customRange.start}" />
            </div>
            <div class="date-input-group">
              <label for="customEndDate">To:</label>
              <input type="date" id="customEndDate" class="m3-date-input" value="${this.customRange.end}" />
            </div>
            <button class="m3-button filled" id="btnApplyCustomRange" style="height: 38px; padding: 0 18px;">
              <span class="material-symbols-rounded" style="font-size: 18px;">filter_alt</span>
              Apply Filter
            </button>
          </div>
        ` : ''}

        <!-- Summary Metrics Cards -->
        <div class="stats-metrics-grid" style="margin-top: 20px;">
          <div class="metric-card">
            <div class="metric-icon-wrap" style="background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);">
              <span class="material-symbols-rounded">timelapse</span>
            </div>
            <span class="metric-title">Total Logged Time</span>
            <span class="metric-value">${totalTimeFormatted}</span>
          </div>

          <div class="metric-card">
            <div class="metric-icon-wrap" style="background-color: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);">
              <span class="material-symbols-rounded">event_repeat</span>
            </div>
            <span class="metric-title">Total Sessions</span>
            <span class="metric-value">${totalSessions}</span>
          </div>

          <div class="metric-card">
            <div class="metric-icon-wrap" style="background-color: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container);">
              <span class="material-symbols-rounded">avg_pace</span>
            </div>
            <span class="metric-title">Daily Average</span>
            <span class="metric-value">${dailyAverageFormatted}</span>
          </div>
        </div>

        ${leaderboard.length === 0 ? `
          <div class="m3-card empty-state">
            <span class="material-symbols-rounded">timer_off</span>
            <h3>No activities found in this period</h3>
            <p style="margin-bottom: 20px; font-size: 0.9rem;">
              You haven't tracked any time between ${range.startDateStr} and ${range.endDateStr}.
            </p>
            <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
              <button class="m3-button filled" id="btnGoToTracker">
                <span class="material-symbols-rounded">play_arrow</span>
                Start Tracking Now
              </button>
              <button class="m3-button tonal" id="btnLoadDemoFromEmpty">
                <span class="material-symbols-rounded">auto_awesome</span>
                Load Demo Activities
              </button>
            </div>
          </div>
        ` : `
          <!-- Top 3 Podium (When 2 or more activities exist) -->
          ${topThree.length >= 2 ? `
            <div class="podium-container">
              <!-- Rank 2: Silver -->
              ${topThree[1] ? `
                <div class="podium-step step-2">
                  <div class="podium-avatar" style="background-color: var(--badge-silver-bg); color: #cfd8dc;">
                    🥈
                  </div>
                  <div class="podium-name" title="${escapeHTML(topThree[1].title)}">${escapeHTML(topThree[1].title)}</div>
                  <div class="podium-time">${topThree[1].formattedDuration}</div>
                  <div class="podium-block">2</div>
                </div>
              ` : ''}

              <!-- Rank 1: Gold -->
              <div class="podium-step step-1">
                <div class="podium-avatar" style="background-color: var(--badge-gold-bg); color: #ffd54f;">
                  👑
                </div>
                <div class="podium-name" title="${escapeHTML(topThree[0].title)}">${escapeHTML(topThree[0].title)}</div>
                <div class="podium-time">${topThree[0].formattedDuration}</div>
                <div class="podium-block">1</div>
              </div>

              <!-- Rank 3: Bronze -->
              ${topThree[2] ? `
                <div class="podium-step step-3">
                  <div class="podium-avatar" style="background-color: var(--badge-bronze-bg); color: #ffab91;">
                    🥉
                  </div>
                  <div class="podium-name" title="${escapeHTML(topThree[2].title)}">${escapeHTML(topThree[2].title)}</div>
                  <div class="podium-time">${topThree[2].formattedDuration}</div>
                  <div class="podium-block">3</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Detailed Ranked List -->
          <div class="leaderboard-list">
            ${leaderboard.map(item => this.renderLeaderboardItem(item)).join('')}
          </div>
        `}
      </section>
    `;
  }

  renderLeaderboardItem(item) {
    const isTopThree = item.rank <= 3;
    const rankClass = isTopThree ? `rank-${item.rank}` : '';
    const medalEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

    return `
      <div class="leaderboard-item ${rankClass}">
        <div class="rank-badge">${medalEmoji}</div>
        <div class="leaderboard-info">
          <div class="activity-title-row">
            <span class="activity-name">${escapeHTML(item.title)}</span>
            <span class="activity-duration-pill">${item.formattedDuration}</span>
          </div>

          <!-- Progress Bar showing percentage of total time -->
          <div class="activity-progress-bar">
            <div class="activity-progress-fill" style="width: ${Math.max(3, item.percent)}%;"></div>
          </div>

          <div class="activity-meta-row">
            <span>${item.sessionCount} ${item.sessionCount === 1 ? 'session' : 'sessions'} • ${item.humanDuration}</span>
            <span style="font-weight: 600;">${item.percent}% of total time</span>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Segmented period buttons
    const periodButtons = this.container.querySelectorAll('.m3-segment-btn');
    periodButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const period = btn.getAttribute('data-period');
        this.currentPeriod = period;
        await this.loadData();
        this.render();
        this.bindEvents();
      });
    });

    // Custom date range filter
    const btnApply = this.container.querySelector('#btnApplyCustomRange');
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const start = this.container.querySelector('#customStartDate').value;
        const end = this.container.querySelector('#customEndDate').value;
        if (!start || !end) return;

        this.customRange = { start, end };
        await this.loadData();
        this.render();
        this.bindEvents();
      });
    }

    // Empty state triggers
    const btnGoToTracker = this.container.querySelector('#btnGoToTracker');
    if (btnGoToTracker && this.onNavigateToTracker) {
      btnGoToTracker.addEventListener('click', () => this.onNavigateToTracker());
    }

    const btnLoadDemo = this.container.querySelector('#btnLoadDemoFromEmpty');
    if (btnLoadDemo) {
      btnLoadDemo.addEventListener('click', async () => {
        await populateSampleData();
        await this.loadData();
        this.render();
        this.bindEvents();
      });
    }
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
