// Offline IndexedDB Storage Service for "Running out of time"

const DB_NAME = 'RunningOutOfTime_DB';
const DB_VERSION = 2;

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

      // Todos store: simple checkmark task list
      if (!db.objectStoreNames.contains('todos')) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
        todoStore.createIndex('createdAt', 'createdAt', { unique: false });
        todoStore.createIndex('completed', 'completed', { unique: false });
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

// ==================== TO-DOS SYSTEM ====================

export async function getAllTodos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('todos', 'readonly');
      const store = transaction.objectStore('todos');
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort active first, then newest
        const todos = (request.result || []).sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return b.createdAt - a.createdAt;
        });
        // Mirror to localStorage for external consumption
        try {
          localStorage.setItem('root_todos_v1', JSON.stringify(todos));
        } catch (_) {}
        resolve(todos);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      // Fallback to localStorage if store upgrade is pending
      const cached = localStorage.getItem('root_todos_v1');
      resolve(cached ? JSON.parse(cached) : []);
    }
  });
}

export async function addTodo(text, linkedTag = null) {
  if (!text || !text.trim()) return null;
  const db = await openDB();

  const todoItem = {
    id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
    linkedTag: linkedTag || null
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('todos', 'readwrite');
    const store = transaction.objectStore('todos');
    store.put(todoItem);

    transaction.oncomplete = () => {
      getAllTodos(); // updates localStorage cache
      resolve(todoItem);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function toggleTodo(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('todos', 'readwrite');
    const store = transaction.objectStore('todos');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve(null);
      item.completed = !item.completed;
      item.completedAt = item.completed ? Date.now() : null;
      store.put(item);
    };

    transaction.oncomplete = () => {
      getAllTodos();
      resolve(true);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteTodo(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('todos', 'readwrite');
    const store = transaction.objectStore('todos');
    store.delete(id);

    transaction.oncomplete = () => {
      getAllTodos();
      resolve(true);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearCompletedTodos() {
  const db = await openDB();
  const todos = await getAllTodos();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('todos', 'readwrite');
    const store = transaction.objectStore('todos');

    todos.filter(t => t.completed).forEach(t => {
      store.delete(t.id);
    });

    transaction.oncomplete = () => {
      getAllTodos();
      resolve(true);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

// ==================== INTEROPERABLE DATA EXPORT & SHARE ====================

export async function exportAllData() {
  const sessions = await getAllSessions();
  const tags = await getAllTags();
  const todos = await getAllTodos();

  return {
    app: 'Root',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    summary: {
      totalSessions: sessions.length,
      totalTags: tags.length,
      totalTodos: todos.length,
      totalDurationMs: sessions.reduce((acc, s) => acc + (s.durationMs || 0), 0)
    },
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.title || '',
      tags: Array.isArray(s.tags) ? s.tags : [],
      date: s.dateStr || new Date(s.startTime).toISOString().split('T')[0],
      startTime: s.startTime,
      startTimeISO: new Date(s.startTime).toISOString(),
      endTime: s.endTime,
      endTimeISO: s.endTime ? new Date(s.endTime).toISOString() : null,
      durationMs: s.durationMs || 0,
      durationMinutes: Math.round(((s.durationMs || 0) / 60000) * 10) / 10,
      notes: s.notes || ''
    })),
    todos,
    tags
  };
}

export async function exportSessionsCSV() {
  const sessions = await getAllSessions();

  const headers = [
    'ID',
    'Title',
    'Tags',
    'Date',
    'Start Time (ISO)',
    'End Time (ISO)',
    'Duration (Seconds)',
    'Duration (Minutes)',
    'Notes'
  ];

  const escapeCSV = (val) => {
    const str = String(val == null ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = sessions.map(s => [
    escapeCSV(s.id),
    escapeCSV(s.title),
    escapeCSV(Array.isArray(s.tags) ? s.tags.join('; ') : ''),
    escapeCSV(s.dateStr || new Date(s.startTime).toISOString().split('T')[0]),
    escapeCSV(new Date(s.startTime).toISOString()),
    escapeCSV(s.endTime ? new Date(s.endTime).toISOString() : ''),
    escapeCSV(Math.round((s.durationMs || 0) / 1000)),
    escapeCSV(Math.round(((s.durationMs || 0) / 60000) * 10) / 10),
    escapeCSV(s.notes || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

export async function shareOrDownloadData(format = 'json') {
  const isCSV = format === 'csv';
  const content = isCSV ? await exportSessionsCSV() : JSON.stringify(await exportAllData(), null, 2);
  const mimeType = isCSV ? 'text/csv' : 'application/json';
  const fileName = `Root-export-${new Date().toISOString().split('T')[0]}.${isCSV ? 'csv' : 'json'}`;

  // Try Native Web Share API (Android native share sheet to Google Drive, WhatsApp, Files, Gmail, etc.)
  if (navigator.canShare && navigator.canShare({ files: [new File([content], fileName, { type: mimeType })] })) {
    try {
      const file = new File([content], fileName, { type: mimeType });
      await navigator.share({
        title: 'Root Data Export',
        text: `Exported Root data (${fileName})`,
        files: [file]
      });
      return { shared: true };
    } catch (err) {
      if (err.name === 'AbortError') return { cancelled: true };
    }
  }

  // Standard File Download Fallback
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { downloaded: true, fileName };
}

export async function importData(jsonData) {
  if (!jsonData || !Array.isArray(jsonData.sessions)) {
    throw new Error('Invalid backup format: sessions array missing');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions', 'tags', 'todos'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const tagStore = transaction.objectStore('tags');
    const todoStore = transaction.objectStore('todos');

    jsonData.sessions.forEach(sess => {
      sessionStore.put(sess);
    });

    if (Array.isArray(jsonData.tags)) {
      jsonData.tags.forEach(tag => {
        tagStore.put(tag);
      });
    }

    if (Array.isArray(jsonData.todos)) {
      jsonData.todos.forEach(todo => {
        todoStore.put(todo);
      });
    }

    transaction.oncomplete = () => {
      getAllTodos();
      resolve(true);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions', 'tags', 'todos'], 'readwrite');
    transaction.objectStore('sessions').clear();
    transaction.objectStore('tags').clear();
    transaction.objectStore('todos').clear();
    localStorage.removeItem('rott_active_timer');
    localStorage.removeItem('root_todos_v1');
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

  // Also add sample todos
  await addTodo('Complete math problem set');
  await addTodo('Review biology flashcards');
  await addTodo('Submit coding assignment');
}
