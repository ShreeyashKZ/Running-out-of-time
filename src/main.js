// Main Application Coordinator for "Running out of time"
import { timerService, formatTickerTime, formatHumanDuration } from './services/timer.js';
import { ActiveTracker } from './components/ActiveTracker.js';
import { LeaderboardView } from './components/LeaderboardView.js';
import { StatsView } from './components/StatsView.js';
import { HistoryView } from './components/HistoryView.js';
import { ManualEntryModal } from './components/ManualEntryModal.js';
import { DataModal } from './components/DataModal.js';

class App {
  constructor() {
    this.currentTab = 'tracker';
    this.activeViewController = null;
    this.mainContainer = document.getElementById('mainContent');
    this.modalContainer = document.getElementById('modalContainer');

    this.init();
  }

  init() {
    this.initTheme();
    this.bindGlobalNavigation();
    this.bindHeaderActions();
    this.bindTimerGlobalListeners();
    this.navigateTo('tracker');
    this.registerServiceWorker();
  }

  // ==================== THEME MANAGEMENT ====================
  initTheme() {
    const savedTheme = localStorage.getItem('rott_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('rott_theme', next);
        this.updateThemeIcon(next);

        // Refresh stats chart colors if currently active
        if (this.currentTab === 'analytics' && this.activeViewController) {
          this.activeViewController.initCharts();
        }
      });
    }
  }

  updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  // ==================== VIEW NAVIGATION ====================
  bindGlobalNavigation() {
    const navButtons = document.querySelectorAll('.nav-destination');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.navigateTo(tab);
      });
    });
  }

  navigateTo(tab) {
    if (this.activeViewController && typeof this.activeViewController.destroy === 'function') {
      this.activeViewController.destroy();
    }

    this.currentTab = tab;

    // Update active nav button
    document.querySelectorAll('.nav-destination').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    this.mainContainer.innerHTML = '';

    switch (tab) {
      case 'tracker':
        this.activeViewController = new ActiveTracker(
          this.mainContainer,
          (completedSession) => {
            this.showSnackbar(`Recorded "${completedSession.title}" for ${formatHumanDuration(completedSession.durationMs)}`);
          },
          (initialTags) => {
            this.openManualEntry({ isClaimMode: true, tags: initialTags });
          }
        );
        break;

      case 'leaderboard':
        this.activeViewController = new LeaderboardView(this.mainContainer, () => {
          this.navigateTo('tracker');
        });
        break;

      case 'analytics':
        this.activeViewController = new StatsView(this.mainContainer);
        break;

      case 'history':
        this.activeViewController = new HistoryView(this.mainContainer, () => {
          this.openManualEntry();
        });
        break;
    }

    this.updateQuickBarVisibility();
  }

  // ==================== HEADER ACTIONS ====================
  bindHeaderActions() {
    const btnManual = document.getElementById('btnManualEntry');
    if (btnManual) {
      btnManual.addEventListener('click', () => this.openManualEntry());
    }

    const btnData = document.getElementById('btnDataManagement');
    if (btnData) {
      btnData.addEventListener('click', () => {
        new DataModal(this.modalContainer, () => {
          this.navigateTo(this.currentTab);
        });
      });
    }

    const btnQuickStop = document.getElementById('btnQuickStop');
    if (btnQuickStop) {
      btnQuickStop.addEventListener('click', async (e) => {
        e.stopPropagation();
        const completed = await timerService.stopTimer();
        if (completed) {
          this.showSnackbar(`Recorded "${completed.title}" for ${formatHumanDuration(completed.durationMs)}`);
          this.navigateTo(this.currentTab);
        }
      });
    }

    const quickChip = document.getElementById('quickTimerChip');
    if (quickChip) {
      quickChip.addEventListener('click', () => {
        this.navigateTo('tracker');
      });
    }
  }

  openManualEntry(options = {}) {
    new ManualEntryModal(this.modalContainer, (session) => {
      const actionName = options.isClaimMode ? 'Claimed' : 'Saved';
      this.showSnackbar(`${actionName} "${session.title}" (${formatHumanDuration(session.durationMs)})`);
      this.navigateTo(this.currentTab);
    }, options);
  }

  // ==================== BACKGROUND-RESILIENT TIMER LISTENERS ====================
  bindTimerGlobalListeners() {
    const headerStatus = document.getElementById('headerStatus');
    const headerStatusLabel = document.getElementById('headerStatusLabel');
    const quickBar = document.getElementById('quickActiveBar');
    const quickActivityName = document.getElementById('quickActivityName');
    const quickTimerElapsed = document.getElementById('quickTimerElapsed');

    timerService.onTick((tickData) => {
      if (tickData.isTracking && tickData.activeSession) {
        document.title = `⏳ ${tickData.activeElapsedFormatted} - ${tickData.activeSession.title} | Running out of time`;
        if (quickTimerElapsed) quickTimerElapsed.textContent = tickData.activeElapsedFormatted;
      } else {
        document.title = `${tickData.localTimeFormatted} • Running out of time`;
      }
    });

    timerService.onStateChange((activeSession) => {
      if (activeSession && activeSession.isRunning) {
        headerStatus.classList.add('active');
        headerStatusLabel.textContent = 'Tracking Live';
        if (quickActivityName) quickActivityName.textContent = activeSession.title;
        this.updateQuickBarVisibility();
      } else {
        headerStatus.classList.remove('active');
        headerStatusLabel.textContent = 'Idle';
        document.title = 'Running out of time';
        if (quickBar) quickBar.style.display = 'none';
      }
    });

    // Check initial state
    if (timerService.isActive()) {
      const active = timerService.getActiveSession();
      headerStatus.classList.add('active');
      headerStatusLabel.textContent = 'Tracking Live';
      if (quickActivityName) quickActivityName.textContent = active.title;
      this.updateQuickBarVisibility();
    }
  }

  updateQuickBarVisibility() {
    const quickBar = document.getElementById('quickActiveBar');
    if (!quickBar) return;

    if (timerService.isActive() && this.currentTab !== 'tracker') {
      quickBar.style.display = 'flex';
    } else {
      quickBar.style.display = 'none';
    }
  }

  // ==================== SNACKBAR NOTIFICATIONS ====================
  showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    const snackbarText = document.getElementById('snackbarText');
    if (!snackbar || !snackbarText) return;

    snackbarText.textContent = message;
    snackbar.classList.add('show');

    setTimeout(() => {
      snackbar.classList.remove('show');
    }, 4000);
  }

  // ==================== OFFLINE SERVICE WORKER ====================
  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW registration skipped in dev mode:', err);
      });
    }
  }
}

// Bootstrap app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
