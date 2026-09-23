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

    this.container.innerHTML = `
      <section class="leaderboard-view">
        <!-- View Header -->
        <div class="view-header">
          <div class="view-title-row">
            <div>
              <h2 class="view-title">Time Leaderboard</h2>
              <p class="view-subtitle">Ranked analysis of how your finite hours are allocated.</p>
            </div>
            <div class="period-status-badge">
              <span class="status-indicator-dot"></span>
              <span>${escapeHTML(range.label)}</span>
            </div>
          </div>
        </div>

        <!-- M3 Segmented Period Selector -->
        <div class="segmented-control-wrapper">
          <div class="m3-segmented-group" id="periodSegmentedGroup">
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.WEEKLY ? 'active' : ''}" data-period="${PERIOD_TYPES.WEEKLY}">
              <span class="material-symbols-rounded">view_week</span>
              This Week
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.MONTHLY ? 'active' : ''}" data-period="${PERIOD_TYPES.MONTHLY}">
              <span class="material-symbols-rounded">calendar_month</span>
              This Month
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.ALL_TIME ? 'active' : ''}" data-period="${PERIOD_TYPES.ALL_TIME}">
              <span class="material-symbols-rounded">all_inclusive</span>
              All-Time
            </button>
            <button class="m3-segment-btn ${periodType === PERIOD_TYPES.CUSTOM ? 'active' : ''}" data-period="${PERIOD_TYPES.CUSTOM}">
              <span class="material-symbols-rounded">date_range</span>
              Custom Range
            </button>
          </div>
        </div>

        <!-- Custom Date Range Picker -->
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
            <button class="m3-button filled" id="btnApplyCustomRange" style="height: 38px; padding: 0 20px;">
              <span class="material-symbols-rounded" style="font-size: 18px;">tune</span>
              Filter Period
            </button>
          </div>
        ` : ''}

        <!-- Summary Metrics Cards -->
        <div class="stats-metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Total Logged Time</span>
              <span class="material-symbols-rounded metric-icon">timelapse</span>
            </div>
            <span class="metric-value">${totalTimeFormatted}</span>
            <span class="metric-subtext">Across selected period</span>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Tracked Sessions</span>
              <span class="material-symbols-rounded metric-icon">event_note</span>
            </div>
            <span class="metric-value">${totalSessions}</span>
            <span class="metric-subtext">Completed activity blocks</span>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Daily Average</span>
              <span class="material-symbols-rounded metric-icon">pace</span>
            </div>
            <span class="metric-value">${dailyAverageFormatted}</span>
            <span class="metric-subtext">Per active day</span>
          </div>
        </div>

        ${leaderboard.length === 0 ? `
          <div class="m3-card empty-state">
            <span class="material-symbols-rounded empty-icon">hourglass_empty</span>
            <h3>No activities logged in this period</h3>
            <p style="margin-bottom: 24px; font-size: 0.9rem; max-width: 440px; margin-inline: auto;">
              No sessions found for ${range.startDateStr} to ${range.endDateStr}. Start the continuous timer or generate sample data to test the leaderboard.
            </p>
            <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
              <button class="m3-button filled" id="btnGoToTracker">
                <span class="material-symbols-rounded">play_arrow</span>
                Start Tracking Now
              </button>
              <button class="m3-button tonal" id="btnLoadDemoFromEmpty">
                <span class="material-symbols-rounded">auto_awesome</span>
                Populate 2-Week Sample Data
              </button>
            </div>
          </div>
        ` : `
          <!-- Elevated Top 3 Podium -->
          ${topThree.length >= 2 ? `
            <div class="podium-section">
              <div class="podium-container">
                <!-- Rank 2: Silver -->
                ${topThree[1] ? `
                  <div class="podium-step step-2">
                    <div class="podium-badge-ring silver-ring">
                      <span class="podium-rank-num">2</span>
                    </div>
                    <div class="podium-name" title="${escapeHTML(topThree[1].title)}">${escapeHTML(topThree[1].title)}</div>
                    <div class="podium-time">${topThree[1].formattedDuration}</div>
                    <div class="podium-block">
                      <span class="podium-percent">${topThree[1].percent}%</span>
                    </div>
                  </div>
                ` : ''}

                <!-- Rank 1: Gold -->
                <div class="podium-step step-1">
                  <div class="podium-badge-ring gold-ring">
                    <span class="material-symbols-rounded crown-icon">stars</span>
                    <span class="podium-rank-num">1</span>
                  </div>
                  <div class="podium-name" title="${escapeHTML(topThree[0].title)}">${escapeHTML(topThree[0].title)}</div>
                  <div class="podium-time">${topThree[0].formattedDuration}</div>
                  <div class="podium-block">
                    <span class="podium-percent">${topThree[0].percent}%</span>
                  </div>
                </div>

                <!-- Rank 3: Bronze -->
                ${topThree[2] ? `
                  <div class="podium-step step-3">
                    <div class="podium-badge-ring bronze-ring">
                      <span class="podium-rank-num">3</span>
                    </div>
                    <div class="podium-name" title="${escapeHTML(topThree[2].title)}">${escapeHTML(topThree[2].title)}</div>
                    <div class="podium-time">${topThree[2].formattedDuration}</div>
                    <div class="podium-block">
                      <span class="podium-percent">${topThree[2].percent}%</span>
                    </div>
                  </div>
                ` : ''}
              </div>
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

    return `
      <div class="leaderboard-item ${rankClass}">
        <div class="rank-badge">
          <span>${item.rank}</span>
        </div>
        <div class="leaderboard-info">
          <div class="activity-title-row">
            <span class="activity-name">${escapeHTML(item.title)}</span>
            <span class="activity-duration-pill">${item.formattedDuration}</span>
          </div>

          <div class="activity-progress-bar">
            <div class="activity-progress-fill" style="width: ${Math.max(2, item.percent)}%;"></div>
          </div>

          <div class="activity-meta-row">
            <span>${item.sessionCount} ${item.sessionCount === 1 ? 'session' : 'sessions'} • ${item.humanDuration}</span>
            <span class="percent-meta">${item.percent}% of logged time</span>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
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
