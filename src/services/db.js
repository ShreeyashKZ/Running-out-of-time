// Offline IndexedDB Storage Service for "Running out of time"

const DB_NAME = 'RunningOutOfTime_DB';
const DB_VERSION = 1;

let dbInstance = null;

export async function openDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Sessions store: indexed by dateStr, startTime, and title
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionStore.createIndex('dateStr', 'dateStr', { unique: false });
        sessionStore.createIndex('startTime', 'startTime', { unique: false });
        sessionStore.createIndex('title', 'title', { unique: false });
      }

      // Tags store: remember past activity names with frequency and last used timestamp
      if (!db.objectStoreNames.contains('tags')) {
        const tagStore = db.createObjectStore('tags', { keyPath: 'name' });
        tagStore.createIndex('lastUsed', 'lastUsed', { unique: false });
        tagStore.createIndex('useCount', 'useCount', { unique: false });
      }

      // App metadata store (active session, preferences)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB opening error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ==================== SESSIONS CRUD ====================

export async function getAllSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sessions', 'readonly');
    const store = transaction.objectStore('sessions');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort newest first
      const sessions = request.result.sort((a, b) => b.startTime - a.startTime);
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions', 'tags'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const tagStore = transaction.objectStore('tags');

    // Ensure session ID
    if (!session.id) {
      session.id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    session.createdAt = session.createdAt || Date.now();

    sessionStore.put(session);

    // Save/update tags
    if (session.title && session.title.trim()) {
      saveOrUpdateTag(tagStore, session.title.trim());
    }
    if (Array.isArray(session.tags)) {
      session.tags.forEach(t => {
        if (t && t.trim()) saveOrUpdateTag(tagStore, t.trim());
      });
    }

    transaction.oncomplete = () => resolve(session);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteSession(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sessions', 'readwrite');
    const store = transaction.objectStore('sessions');
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function updateSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sessions', 'readwrite');
    const store = transaction.objectStore('sessions');
    const request = store.put(session);

    request.onsuccess = () => resolve(session);
    request.onerror = () => reject(request.error);
  });
}

// ==================== TAGS & AUTOCOMPLETE MEMORY ====================

function saveOrUpdateTag(tagStore, tagName) {
  const getReq = tagStore.get(tagName.toLowerCase());
  getReq.onsuccess = () => {
    const existing = getReq.result;
    if (existing) {
      existing.displayName = tagName; // preserve casing
      existing.useCount = (existing.useCount || 1) + 1;
      existing.lastUsed = Date.now();
      tagStore.put(existing);
    } else {
      tagStore.put({
        name: tagName.toLowerCase(),
        displayName: tagName,
        useCount: 1,
        lastUsed: Date.now()
      });
    }
  };
}

export async function getAllTags() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tags', 'readonly');
    const store = transaction.objectStore('tags');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by frequency and recency
      const tags = request.result.sort((a, b) => {
        if (b.useCount !== a.useCount) return b.useCount - a.useCount;
        return b.lastUsed - a.lastUsed;
      });
      resolve(tags);
    };
    request.onerror = () => reject(request.error);
  });
}

// ==================== ACTIVE TRACKER STATE ====================

export function getActiveTimerState() {
  try {
    const saved = localStorage.getItem('rott_active_timer');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function saveActiveTimerState(state) {
  try {
    if (!state) {
      localStorage.removeItem('rott_active_timer');
    } else {
      localStorage.setItem('rott_active_timer', JSON.stringify(state));
    }
  } catch (e) {
    console.error('Error saving active timer state', e);
  }
}

// ==================== DATA EXPORT & IMPORT ====================

export async function exportAllData() {
  const sessions = await getAllSessions();
  const tags = await getAllTags();
  return {
    version: 1,
    appName: 'Running out of time',
    exportedAt: new Date().toISOString(),
    sessions,
    tags
  };
}

export async function importData(jsonData) {
  if (!jsonData || !Array.isArray(jsonData.sessions)) {
    throw new Error('Invalid backup format: sessions array missing');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions', 'tags'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const tagStore = transaction.objectStore('tags');

    jsonData.sessions.forEach(sess => {
      sessionStore.put(sess);
    });

    if (Array.isArray(jsonData.tags)) {
      jsonData.tags.forEach(tag => {
        tagStore.put(tag);
      });
    }

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions', 'tags'], 'readwrite');
    transaction.objectStore('sessions').clear();
    transaction.objectStore('tags').clear();
    localStorage.removeItem('rott_active_timer');
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

// Generate Realistic Sample Data for Demo/Testing
export async function populateSampleData() {
  const sampleActivities = [
    { title: 'Attending class', tags: ['class', 'study'], durationHours: 3.08 }, // 3h 5m
    { title: 'Coding project', tags: ['coding', 'dev'], durationHours: 2.5 },
    { title: 'Gym & workout', tags: ['fitness', 'health'], durationHours: 1.25 },
    { title: 'Reading research papers', tags: ['reading', 'study'], durationHours: 1.75 },
    { title: 'Client meeting', tags: ['work', 'meeting'], durationHours: 0.8 },
    { title: 'Attending class', tags: ['class', 'study'], durationHours: 2.0 },
    { title: 'Deep learning research', tags: ['ai', 'study'], durationHours: 4.2 }
  ];

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Generate sessions across past 14 days
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const targetDay = new Date(now - dayOffset * oneDay);
    const dateStr = targetDay.toISOString().split('T')[0];

    // 2-3 sessions per day
    const numSessions = 2 + (dayOffset % 2);
    for (let i = 0; i < numSessions; i++) {
      const act = sampleActivities[(dayOffset * 2 + i) % sampleActivities.length];
      const startHour = 9 + (i * 4); // 9am, 1pm, 5pm
      const startTime = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), startHour, 15).getTime();
      const durationMs = Math.round(act.durationHours * 3600 * 1000);
      const endTime = startTime + durationMs;

      await addSession({
        title: act.title,
        tags: act.tags,
        startTime,
        endTime,
        durationMs,
        dateStr,
        notes: `Sample tracked session for ${act.title}`
      });
    }
  }
}
