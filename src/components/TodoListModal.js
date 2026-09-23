// To-Do List Sheet Component for "Root"
import { getAllTodos, addTodo, toggleTodo, deleteTodo, clearCompletedTodos } from '../services/db.js';

export class TodoListModal {
  constructor(container, options = {}) {
    this.container = container;
    this.onClose = options.onClose || (() => {});
    this.onTrackTask = options.onTrackTask || (() => {});
    this.currentFilter = 'all'; // 'all', 'active', 'completed'
    this.todos = [];

    this.init();
  }

  async init() {
    this.todos = await getAllTodos();
    this.render();
    this.bindEvents();
  }

  render() {
    const activeCount = this.todos.filter(t => !t.completed).length;
    const completedCount = this.todos.filter(t => t.completed).length;

    let filtered = this.todos;
    if (this.currentFilter === 'active') {
      filtered = this.todos.filter(t => !t.completed);
    } else if (this.currentFilter === 'completed') {
      filtered = this.todos.filter(t => t.completed);
    }

    this.container.innerHTML = `
      <div class="m3-dialog todo-modal-dialog">
        <!-- Dialog Header -->
        <div class="dialog-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="todo-header-icon">
              <span class="material-symbols-rounded">checklist</span>
            </div>
            <div>
              <h3 class="dialog-title" style="margin: 0; line-height: 1.2;">Tasks & To-Dos</h3>
              <div class="todo-stats-sublabel">
                ${activeCount} remaining • ${completedCount} completed
              </div>
            </div>
          </div>
          <button class="m3-icon-button" id="btnCloseTodoModal" title="Close" aria-label="Close dialog">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <!-- Add Task Input -->
        <div class="dialog-body" style="padding-bottom: 8px;">
          <form id="formAddTodo" class="todo-add-form" onsubmit="return false;">
            <div class="m3-field-container" style="flex: 1;">
              <span class="material-symbols-rounded m3-field-icon">add_task</span>
              <input
                type="text"
                id="inputNewTodo"
                class="m3-text-field"
                placeholder="Write a task (e.g. Finish math assignment)..."
                autocomplete="off"
                maxlength="140"
              />
            </div>
            <button type="submit" class="m3-button filled todo-add-btn" id="btnAddTodo">
              <span class="material-symbols-rounded" style="font-size: 18px;">add</span>
              Add
            </button>
          </form>

          <!-- Filter Chips -->
          <div class="todo-filter-strip">
            <button type="button" class="todo-filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
              All (${this.todos.length})
            </button>
            <button type="button" class="todo-filter-btn ${this.currentFilter === 'active' ? 'active' : ''}" data-filter="active">
              Active (${activeCount})
            </button>
            <button type="button" class="todo-filter-btn ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
              Done (${completedCount})
            </button>
          </div>

          <!-- Tasks List -->
          <div class="todo-items-list" id="todoItemsList">
            ${filtered.length === 0 ? `
              <div class="todo-empty-state">
                <span class="material-symbols-rounded" style="font-size: 36px; opacity: 0.5;">task_alt</span>
                <p style="margin-top: 6px; font-size: 0.88rem; color: var(--md-sys-color-outline);">
                  ${this.currentFilter === 'completed' ? 'No completed tasks yet.' : 'No tasks on your list. Add one above!'}
                </p>
              </div>
            ` : filtered.map(item => `
              <div class="todo-item-row ${item.completed ? 'is-completed' : ''}" data-id="${item.id}">
                <button type="button" class="btn-toggle-todo todo-checkbox" title="${item.completed ? 'Mark as active' : 'Mark as completed'}">
                  <span class="material-symbols-rounded">
                    ${item.completed ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                </button>
                <div class="todo-text-wrap">
                  <span class="todo-text">${escapeHTML(item.text)}</span>
                </div>
                <div class="todo-actions">
                  ${!item.completed ? `
                    <button type="button" class="btn-track-todo m3-button text small" data-text="${escapeHTML(item.text)}" title="Track this task now in Root">
                      <span class="material-symbols-rounded" style="font-size: 16px;">play_circle</span>
                      <span class="btn-track-label">Track</span>
                    </button>
                  ` : ''}
                  <button type="button" class="btn-delete-todo m3-icon-button small-btn" title="Delete task">
                    <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-outline);">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="dialog-actions" style="justify-content: space-between; border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 12px;">
          ${completedCount > 0 ? `
            <button type="button" class="m3-button text" id="btnClearCompleted" style="color: var(--md-sys-color-error); font-size: 0.82rem; padding: 0 10px;">
              <span class="material-symbols-rounded" style="font-size: 16px;">clear_all</span>
              Clear Done (${completedCount})
            </button>
          ` : '<span></span>'}
          <button type="button" class="m3-button tonal" id="btnDoneTodoModal" style="height: 36px; padding: 0 18px;">
            Done
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const dialog = this.container.querySelector('.todo-modal-dialog');
    if (!dialog) return;

    // Close buttons
    const btnClose = dialog.querySelector('#btnCloseTodoModal');
    const btnDone = dialog.querySelector('#btnDoneTodoModal');
    if (btnClose) btnClose.addEventListener('click', () => this.close());
    if (btnDone) btnDone.addEventListener('click', () => this.close());

    // Add task
    const form = dialog.querySelector('#formAddTodo');
    const input = dialog.querySelector('#inputNewTodo');
    if (form && input) {
      const handleAdd = async () => {
        const text = input.value.trim();
        if (text) {
          await addTodo(text);
          this.todos = await getAllTodos();
          this.render();
          this.bindEvents();
          const nextInput = this.container.querySelector('#inputNewTodo');
          if (nextInput) nextInput.focus();
        }
      };

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAdd();
      });
    }

    // Filter clicks
    dialog.querySelectorAll('.todo-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentFilter = btn.dataset.filter;
        this.render();
        this.bindEvents();
      });
    });

    // Checkbox toggle
    dialog.querySelectorAll('.btn-toggle-todo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('.todo-item-row');
        if (row && row.dataset.id) {
          await toggleTodo(row.dataset.id);
          this.todos = await getAllTodos();
          this.render();
          this.bindEvents();
        }
      });
    });

    // Delete task
    dialog.querySelectorAll('.btn-delete-todo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('.todo-item-row');
        if (row && row.dataset.id) {
          await deleteTodo(row.dataset.id);
          this.todos = await getAllTodos();
          this.render();
          this.bindEvents();
        }
      });
    });

    // Clear completed
    const btnClear = dialog.querySelector('#btnClearCompleted');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        await clearCompletedTodos();
        this.todos = await getAllTodos();
        this.render();
        this.bindEvents();
      });
    }

    // Track this task in Root tracker
    dialog.querySelectorAll('.btn-track-todo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.dataset.text;
        if (text) {
          this.onTrackTask(text);
          this.close();
        }
      });
    });
  }

  close() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.onClose();
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
