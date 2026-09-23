// Stats & Visual Analytics Component for "Running out of time"
import { getAnalyticsData, PERIOD_TYPES } from '../services/analytics.js';
import Chart from 'chart.js/auto';

export class StatsView {
  constructor(container) {
    this.container = container;
    this.currentPeriod = PERIOD_TYPES.WEEKLY;
    this.customRange = {
      start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    };
    this.data = null;
    this.donutChartInstance = null;
    this.barChartInstance = null;

    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
    this.bindEvents();
    this.initCharts();
  }

  destroy() {
    if (this.donutChartInstance) this.donutChartInstance.destroy();
    if (this.barChartInstance) this.barChartInstance.destroy();
  }

  async loadData() {
    this.data = await getAnalyticsData(this.currentPeriod, this.customRange);
  }

  render() {
    const { periodType, range, totalTimeFormatted, totalSessions, dailyAverageFormatted, topActivity } = this.data;

    this.container.innerHTML = `
      <section class="stats-view">
        <div class="view-header">
          <div class="view-title-row">
            <h2 class="view-title">Time Analytics</h2>
            <span class="m3-chip active">
              <span class="material-symbols-rounded" style="font-size: 16px;">insights</span>
              ${escapeHTML(range.label)}
            </span>
          </div>
          <p class="view-subtitle">Interactive visual insights and time distribution metrics.</p>
        </div>

        <!-- M3 Segmented Period Selector -->
        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
          <div class="m3-segmented-group" id="statsPeriodSegmented">
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
          <div class="custom-range-card" style="margin-bottom: 20px;">
            <div class="date-input-group">
              <label for="statsCustomStartDate">From:</label>
              <input type="date" id="statsCustomStartDate" class="m3-date-input" value="${this.customRange.start}" />
            </div>
            <div class="date-input-group">
              <label for="statsCustomEndDate">To:</label>
              <input type="date" id="statsCustomEndDate" class="m3-date-input" value="${this.customRange.end}" />
            </div>
            <button class="m3-button filled" id="btnStatsApplyCustom" style="height: 38px; padding: 0 18px;">
              <span class="material-symbols-rounded" style="font-size: 18px;">filter_alt</span>
              Apply
            </button>
          </div>
        ` : ''}

        <!-- Metric Highlights Grid -->
        <div class="stats-metrics-grid">
          <div class="metric-card">
            <span class="metric-title">Total Logged Time</span>
            <span class="metric-value">${totalTimeFormatted}</span>
          </div>

          <div class="metric-card">
            <span class="metric-title">Daily Average</span>
            <span class="metric-value">${dailyAverageFormatted}</span>
          </div>

          <div class="metric-card">
            <span class="metric-title">Top Activity</span>
            <span class="metric-value" style="font-size: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${topActivity ? escapeHTML(topActivity.title) : 'None yet'}
            </span>
          </div>

          <div class="metric-card">
            <span class="metric-title">Total Sessions</span>
            <span class="metric-value">${totalSessions}</span>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
          <!-- Donut Breakdown -->
          <div class="chart-card">
            <h3 class="chart-card-title">
              <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary);">pie_chart</span>
              Activity Distribution
            </h3>
            <div class="chart-canvas-container">
              <canvas id="donutChartCanvas"></canvas>
            </div>
          </div>

          <!-- Daily Timeline Bar Chart -->
          <div class="chart-card">
            <h3 class="chart-card-title">
              <span class="material-symbols-rounded" style="color: var(--md-sys-color-tertiary);">bar_chart</span>
              Daily Logged Hours
            </h3>
            <div class="chart-canvas-container">
              <canvas id="dailyBarChartCanvas"></canvas>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cac4d0' : '#49454f';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    // Palette for donut chart
    const colors = [
      '#d0bcff', // Primary violet
      '#7bd0c1', // Tertiary teal
      '#ffd54f', // Amber gold
      '#ffb4ab', // Coral
      '#80cbc4', // Aqua
      '#9fa8da'  // Indigo
    ];

    // 1. Donut Chart
    const donutCtx = this.container.querySelector('#donutChartCanvas');
    if (donutCtx && this.data.donutChart.values.length > 0) {
      if (this.donutChartInstance) this.donutChartInstance.destroy();

      this.donutChartInstance = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: this.data.donutChart.labels,
          datasets: [{
            data: this.data.donutChart.values,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: isDark ? '#211f26' : '#ffffff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                boxWidth: 12,
                padding: 14,
                font: { family: "'Outfit', sans-serif", size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.label}: ${context.raw} hrs`
              }
            }
          },
          cutout: '68%'
        }
      });
    }

    // 2. Daily Bar Chart
    const barCtx = this.container.querySelector('#dailyBarChartCanvas');
    if (barCtx && this.data.dailyChart.hours.length > 0) {
      if (this.barChartInstance) this.barChartInstance.destroy();

      this.barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: this.data.dailyChart.labels,
          datasets: [{
            label: 'Hours Tracked',
            data: this.data.dailyChart.hours,
            backgroundColor: '#7bd0c1',
            borderRadius: 6,
            hoverBackgroundColor: '#a7f3d0'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: "'Outfit', sans-serif", size: 11 } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { family: "'Outfit', sans-serif", size: 11 },
                callback: (val) => `${val}h`
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => ` Tracked: ${context.raw} hours`
              }
            }
          }
        }
      });
    }
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
        this.initCharts();
      });
    });

    const btnApply = this.container.querySelector('#btnStatsApplyCustom');
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const start = this.container.querySelector('#statsCustomStartDate').value;
        const end = this.container.querySelector('#statsCustomEndDate').value;
        if (!start || !end) return;

        this.customRange = { start, end };
        await this.loadData();
        this.render();
        this.bindEvents();
        this.initCharts();
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
