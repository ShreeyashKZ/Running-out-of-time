// Analytics & Leaderboard Engine for "Running out of time"
import { getAllSessions } from './db.js';
import { formatCompactDuration, formatHumanDuration } from './timer.js';

export const PERIOD_TYPES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  ALL_TIME: 'all_time',
  CUSTOM: 'custom'
};

export async function getAnalyticsData(periodType = PERIOD_TYPES.WEEKLY, customRange = null) {
  const allSessions = await getAllSessions();
  const range = computeDateRange(periodType, customRange);

  // Filter sessions within date range
  const filteredSessions = allSessions.filter(s => {
    return s.startTime >= range.startTimestamp && s.startTime <= range.endTimestamp;
  });

  // Calculate Aggregations
  let totalTimeMs = 0;
  const activityMap = new Map();
  const tagMap = new Map();
  const dailyDistributionMap = new Map();

  for (const session of filteredSessions) {
    const dur = session.durationMs || 0;
    totalTimeMs += dur;

    // Multi-tag/title attribution: Credit each tag in the session with the duration
    const sessionTags = Array.isArray(session.tags) && session.tags.length > 0
      ? session.tags
      : [session.title || 'Untitled'];

    // Track unique tags in this session to prevent duplicate counting within the same session
    const seenTagsInSession = new Set();

    for (const rawTag of sessionTags) {
      const cleanTag = (rawTag || '').trim();
      if (!cleanTag) continue;

      const normTag = cleanTag.toLowerCase();
      if (seenTagsInSession.has(normTag)) continue;
      seenTagsInSession.add(normTag);

      const existing = activityMap.get(normTag) || {
        title: cleanTag, // preserve casing
        normName: normTag,
        totalDurationMs: 0,
        sessionCount: 0,
        relatedTags: new Set()
      };

      existing.totalDurationMs += dur;
      existing.sessionCount += 1;
      sessionTags.forEach(otherTag => {
        if (otherTag && otherTag.trim().toLowerCase() !== normTag) {
          existing.relatedTags.add(otherTag.trim());
        }
      });
      activityMap.set(normTag, existing);

      // Also update tagMap for quick queries
      const tagStat = tagMap.get(normTag) || { tag: cleanTag, totalDurationMs: 0, count: 0 };
      tagStat.totalDurationMs += dur;
      tagStat.count += 1;
      tagMap.set(normTag, tagStat);
    }

    // Daily distribution
    const dateKey = session.dateStr || new Date(session.startTime).toISOString().split('T')[0];
    const dayTotal = dailyDistributionMap.get(dateKey) || 0;
    dailyDistributionMap.set(dateKey, dayTotal + dur);
  }

  // Build Ranked Leaderboard
  const leaderboard = Array.from(activityMap.values())
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
    .map((item, index) => {
      const percent = totalTimeMs > 0 ? (item.totalDurationMs / totalTimeMs) * 100 : 0;
      return {
        rank: index + 1,
        title: item.title,
        totalDurationMs: item.totalDurationMs,
        formattedDuration: formatCompactDuration(item.totalDurationMs),
        humanDuration: formatHumanDuration(item.totalDurationMs),
        sessionCount: item.sessionCount,
        percent: Math.round(percent * 10) / 10,
        tags: Array.from(item.tags)
      };
    });

  // Summary Metrics
  const daysDiff = Math.max(1, Math.round((range.endTimestamp - range.startTimestamp) / (24 * 3600 * 1000)));
  const dailyAverageMs = totalTimeMs > 0 ? Math.round(totalTimeMs / daysDiff) : 0;
  const topActivity = leaderboard.length > 0 ? leaderboard[0] : null;

  // Chart Data: Donut Top 5 + Others
  const topCategories = leaderboard.slice(0, 5);
  const otherDuration = leaderboard.slice(5).reduce((sum, item) => sum + item.totalDurationMs, 0);
  const donutLabels = topCategories.map(c => c.title);
  const donutValues = topCategories.map(c => Math.round((c.totalDurationMs / (3600 * 1000)) * 10) / 10); // in hours
  if (otherDuration > 0) {
    donutLabels.push('Other Activities');
    donutValues.push(Math.round((otherDuration / (3600 * 1000)) * 10) / 10);
  }

  // Chart Data: Timeline Daily Distribution
  const dailyChart = generateDailyChartData(range, dailyDistributionMap);

  return {
    periodType,
    range,
    totalTimeMs,
    totalTimeFormatted: formatCompactDuration(totalTimeMs),
    totalTimeHuman: formatHumanDuration(totalTimeMs),
    totalSessions: filteredSessions.length,
    dailyAverageMs,
    dailyAverageFormatted: formatCompactDuration(dailyAverageMs),
    topActivity,
    leaderboard,
    donutChart: {
      labels: donutLabels,
      values: donutValues
    },
    dailyChart
  };
}

// Compute Start and End Timestamps for selected period
export function computeDateRange(periodType, customRange) {
  const now = new Date();

  if (periodType === PERIOD_TYPES.WEEKLY) {
    // Current Week (Monday to Sunday)
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      label: 'This Week',
      startDateStr: monday.toISOString().split('T')[0],
      endDateStr: sunday.toISOString().split('T')[0],
      startTimestamp: monday.getTime(),
      endTimestamp: sunday.getTime()
    };
  }

  if (periodType === PERIOD_TYPES.MONTHLY) {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      label: 'This Month (' + now.toLocaleString('default', { month: 'long', year: 'numeric' }) + ')',
      startDateStr: firstDay.toISOString().split('T')[0],
      endDateStr: lastDay.toISOString().split('T')[0],
      startTimestamp: firstDay.getTime(),
      endTimestamp: lastDay.getTime()
    };
  }

  if (periodType === PERIOD_TYPES.CUSTOM && customRange && customRange.start && customRange.end) {
    const start = new Date(customRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customRange.end);
    end.setHours(23, 59, 59, 999);

    return {
      label: `Custom: ${customRange.start} to ${customRange.end}`,
      startDateStr: customRange.start,
      endDateStr: customRange.end,
      startTimestamp: start.getTime(),
      endTimestamp: end.getTime()
    };
  }

  // All Time
  return {
    label: 'All Time',
    startDateStr: '2000-01-01',
    endDateStr: now.toISOString().split('T')[0],
    startTimestamp: 0,
    endTimestamp: Date.now() + 86400000
  };
}

function generateDailyChartData(range, dailyDistributionMap) {
  const labels = [];
  const hours = [];
  const oneDay = 24 * 3600 * 1000;

  // If range is within 31 days, generate day-by-day buckets
  const daysCount = Math.min(31, Math.max(1, Math.round((range.endTimestamp - range.startTimestamp) / oneDay)));
  const curDate = new Date(range.startTimestamp);

  for (let i = 0; i < daysCount; i++) {
    const dateStr = curDate.toISOString().split('T')[0];
    const dayName = curDate.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
    labels.push(dayName);

    const ms = dailyDistributionMap.get(dateStr) || 0;
    hours.push(Math.round((ms / (3600 * 1000)) * 10) / 10);

    curDate.setDate(curDate.getDate() + 1);
  }

  return { labels, hours };
}
