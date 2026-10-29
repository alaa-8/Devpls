/**
 * DevPulse — Frontend Architecture & Core Engine
 * Adheres to single-responsibility functions, event delegation, and strict XSS mitigation.
 */

(function () {
  'use strict';

  // --------------------------------------------------
  // 1. Constants & State Storage
  // --------------------------------------------------
  const STORAGE_KEY = 'devpulse_tasks_v1';

  const INITIAL_DEMO_DATA = [
    {
      id: 'task-1',
      title: 'Configure PostgreSQL connection pooling with PgBouncer',
      desc: 'Limit total idle connections across Kubernetes replicas to prevent starvation during cold starts.',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      deadline: '2026-11-04',
      tags: ['database', 'infrastructure', 'backend'],
      createdAt: 1730000000000
    },
    {
      id: 'task-2',
      title: 'Migrate REST endpoints to SSE for real-time status alerts',
      desc: 'Evaluate WebSocket overhead vs Server-Sent Events for one-way server-to-client notifications.',
      status: 'CODE_REVIEW',
      priority: 'HIGH',
      deadline: '2026-11-06',
      tags: ['networking', 'api'],
      createdAt: 1730010000000
    },
    {
      id: 'task-3',
      title: 'Audit client bundle sizes & configure route chunking',
      desc: 'Keep initial vendor bundle under 150KB to preserve sub-second First Contentful Paint metrics.',
      status: 'DONE',
      priority: 'MEDIUM',
      deadline: '2026-10-30',
      tags: ['performance', 'frontend'],
      createdAt: 1730020000000
    }
  ];

  const state = {
    tasks: [],
    filters: {
      query: '',
      status: 'ALL',
      priority: 'ALL',
      sortBy: 'deadline-asc'
    }
  };

  // --------------------------------------------------
  // 2. DOM Node References
  // --------------------------------------------------
  const dom = {
    sidebar: document.getElementById('sidebar'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    taskList: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    resultsCount: document.getElementById('results-count'),
    inputSearch: document.getElementById('input-search'),
    filterStatus: document.getElementById('filter-status'),
    filterPriority: document.getElementById('filter-priority'),
    sortBy: document.getElementById('sort-by'),
    btnOpenModal: document.getElementById('btn-open-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnSeed: document.getElementById('btn-seed'),
    modal: document.getElementById('task-modal'),
    form: document.getElementById('task-form'),
    modalTitle: document.getElementById('modal-title'),
    // Form fields
    fieldId: document.getElementById('task-id'),
    fieldTitle: document.getElementById('task-title'),
    fieldDesc: document.getElementById('task-desc'),
    fieldStatus: document.getElementById('task-status'),
    fieldPriority: document.getElementById('task-priority'),
    fieldDeadline: document.getElementById('task-deadline'),
    fieldTags: document.getElementById('task-tags'),
    // KPIs
    kpiTotal: document.getElementById('kpi-total'),
    kpiProgress: document.getElementById('kpi-progress'),
    kpiReview: document.getElementById('kpi-review'),
    kpiDone: document.getElementById('kpi-done')
  };

  // --------------------------------------------------
  // 3. Storage & Safe Persistence Handlers
  // --------------------------------------------------
  function loadTasksFromStorage() {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (!serialized) return INITIAL_DEMO_DATA;
      const parsed = JSON.parse(serialized);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Storage corrupt or blocked, fallback to demo data.', err);
      return INITIAL_DEMO_DATA;
    }
  }

  function saveTasksToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (err) {
      console.error('Failed to write to localStorage', err);
    }
  }

  // --------------------------------------------------
  // 4. Utility Functions
  // --------------------------------------------------
  function debounce(callback, delayMs) {
    let timerId;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => callback(...args), delayMs);
    };
  }

  function formatStatusLabel(status) {
    const map = {
      TODO: 'To Do',
      IN_PROGRESS: 'In Progress',
      CODE_REVIEW: 'In Review',
      DONE: 'Done'
    };
    return map[status] || status;
  }

  function parsePriorityWeight(priority) {
    const weights = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return weights[priority] || 0;
  }

  // --------------------------------------------------
  // 5. Query, Filtering & Sorting Pipeline
  // --------------------------------------------------
  function getFilteredTasks() {
    const { query, status, priority, sortBy } = state.filters;
    const cleanQuery = query.trim().toLowerCase();

    return state.tasks
      .filter(task => {
        const matchesStatus = status === 'ALL' || task.status === status;
        const matchesPriority = priority === 'ALL' || task.priority === priority;
        const matchesSearch =
          cleanQuery === '' ||
          task.title.toLowerCase().includes(cleanQuery) ||
          task.desc.toLowerCase().includes(cleanQuery) ||
          task.tags.some(t => t.toLowerCase().includes(cleanQuery));

        return matchesStatus && matchesPriority && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline-asc') {
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        if (sortBy === 'deadline-desc') {
          return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        }
        if (sortBy === 'priority-desc') {
          return parsePriorityWeight(b.priority) - parsePriorityWeight(a.priority);
        }
        if (sortBy === 'created-desc') {
          return b.createdAt - a.createdAt;
        }
        return 0;
      });
  }

  // --------------------------------------------------
  // 6. Safe Node Creation & Rendering (Strict XSS Prevention)
  // --------------------------------------------------
  function createTaskItemNode(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.setAttribute('data-id', task.id);

    // Left Container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'task-main';

    // Title Row
    const titleRow = document.createElement('div');
    titleRow.className = 'task-title-row';

    const titleH3 = document.createElement('h3');
    titleH3.className = 'task-title';
    titleH3.textContent = task.title;

    const statusBadge = document.createElement('span');
    statusBadge.className = `badge badge-${task.status.toLowerCase()}`;
    statusBadge.textContent = formatStatusLabel(task.status);

    titleRow.appendChild(titleH3);
    titleRow.appendChild(statusBadge);

    // Description
    const descP = document.createElement('p');
    descP.className = 'task-desc';
    descP.textContent = task.desc || 'No description provided.';

    // Meta Row
    const metaDiv = document.createElement('div');
    metaDiv.className = 'task-meta';

    const prioritySpan = document.createElement('span');
    prioritySpan.className = `priority-flag priority-${task.priority.toLowerCase()}`;
    prioritySpan.textContent = `● ${task.priority}`;

    const deadlineSpan = document.createElement('span');
    deadlineSpan.className = 'task-deadline';
    deadlineSpan.textContent = `Due ${task.deadline}`;

    metaDiv.appendChild(prioritySpan);
    metaDiv.appendChild(deadlineSpan);

    if (task.tags && task.tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'task-tags';
      task.tags.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'task-tag';
        tag.textContent = `#${t}`;
        tagsContainer.appendChild(tag);
      });
      metaDiv.appendChild(tagsContainer);
    }

    mainDiv.appendChild(titleRow);
    mainDiv.appendChild(descP);
    mainDiv.appendChild(metaDiv);

    // Action Controls
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-icon btn-edit';
    btnEdit.setAttribute('aria-label', `Edit task: ${task.title}`);
    btnEdit.title = 'Edit task';
    btnEdit.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-icon btn-danger-icon btn-delete';
    btnDelete.setAttribute('aria-label', `Delete task: ${task.title}`);
    btnDelete.title = 'Delete task';
    btnDelete.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);

    li.appendChild(mainDiv);
    li.appendChild(actionsDiv);

    return li;
  }

  function renderKPIs() {
    const total = state.tasks.length;
    const progress = state.tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const review = state.tasks.filter(t => t.status === 'CODE_REVIEW').length;
    const done = state.tasks.filter(t => t.status === 'DONE').length;

    dom.kpiTotal.textContent = total;
    dom.kpiProgress.textContent = progress;
    dom.kpiReview.textContent = review;
    dom.kpiDone.textContent = done;
  }

  function renderView() {
    const visibleTasks = getFilteredTasks();
    dom.taskList.textContent = '';

    if (visibleTasks.length === 0) {
      dom.emptyState.hidden = false;
      dom.resultsCount.textContent = 'Showing 0 tasks';
    } else {
      dom.emptyState.hidden = true;
      dom.resultsCount.textContent = `Showing ${visibleTasks.length} task${visibleTasks.length === 1 ? '' : 's'}`;
      const fragment = document.createDocumentFragment();
      visibleTasks.forEach(task => {
        fragment.appendChild(createTaskItemNode(task));
      });
      dom.taskList.appendChild(fragment);
    }

    renderKPIs();
  }

  // --------------------------------------------------
  // 7. Modal & Form Lifecycle Handlers
  // --------------------------------------------------
  function openModal(editId = null) {
    dom.form.reset();
    if (editId) {
      const task = state.tasks.find(t => t.id === editId);
      if (!task) return;
      dom.modalTitle.textContent = 'Edit Task';
      dom.fieldId.value = task.id;
      dom.fieldTitle.value = task.title;
      dom.fieldDesc.value = task.desc;
      dom.fieldStatus.value = task.status;
      dom.fieldPriority.value = task.priority;
      dom.fieldDeadline.value = task.deadline;
      dom.fieldTags.value = task.tags.join(', ');
    } else {
      dom.modalTitle.textContent = 'Create Task';
      dom.fieldId.value = '';
      dom.fieldDeadline.value = new Date().toISOString().split('T')[0];
    }
    dom.modal.showModal();
    dom.fieldTitle.focus();
  }

  function closeModal() {
    dom.modal.close();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const id = dom.fieldId.value.trim();
    const tags = dom.fieldTags.value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const taskData = {
      title: dom.fieldTitle.value.trim(),
      desc: dom.fieldDesc.value.trim(),
      status: dom.fieldStatus.value,
      priority: dom.fieldPriority.value,
      deadline: dom.fieldDeadline.value,
      tags
    };

    if (id) {
      state.tasks = state.tasks.map(t => (t.id === id ? { ...t, ...taskData } : t));
    } else {
      const newTask = {
        ...taskData,
        id: 'task-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        createdAt: Date.now()
      };
      state.tasks.unshift(newTask);
    }

    saveTasksToStorage();
    renderView();
    closeModal();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasksToStorage();
    renderView();
  }

  // --------------------------------------------------
  // 8. Client-side CSV Exporter
  // --------------------------------------------------
  function exportToCSV() {
    if (state.tasks.length === 0) {
      alert('Backlog is empty. Nothing to export.');
      return;
    }

    const headers = ['Task ID', 'Title', 'Description', 'Status', 'Priority', 'Deadline', 'Tags'];
    const rows = state.tasks.map(t => [
      `"${t.id}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${(t.desc || '').replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${t.deadline}"`,
      `"${t.tags.join(';')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', `DevPulse_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------
  // 9. Delegated Event Listeners & Binding
  // --------------------------------------------------
  function initEventListeners() {
    dom.btnOpenModal.addEventListener('click', () => openModal());
    dom.btnCloseModal.addEventListener('click', closeModal);
    dom.btnCancelModal.addEventListener('click', closeModal);
    dom.form.addEventListener('submit', handleFormSubmit);

    dom.modal.addEventListener('click', e => {
      const rect = dom.modal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) closeModal();
    });

    dom.btnToggleSidebar.addEventListener('click', () => {
      dom.sidebar.classList.toggle('open');
    });

    dom.taskList.addEventListener('click', e => {
      const editBtn = e.target.closest('.btn-edit');
      const deleteBtn = e.target.closest('.btn-delete');
      const taskItem = e.target.closest('.task-item');

      if (!taskItem) return;
      const taskId = taskItem.getAttribute('data-id');

      if (editBtn) {
        openModal(taskId);
      } else if (deleteBtn) {
        deleteTask(taskId);
      }
    });

    dom.inputSearch.addEventListener('input', debounce(e => {
      state.filters.query = e.target.value;
      renderView();
    }, 250));

    dom.filterStatus.addEventListener('change', e => {
      state.filters.status = e.target.value;
      renderView();
    });

    dom.filterPriority.addEventListener('change', e => {
      state.filters.priority = e.target.value;
      renderView();
    });

    dom.sortBy.addEventListener('change', e => {
      state.filters.sortBy = e.target.value;
      renderView();
    });

    dom.btnExportCsv.addEventListener('click', exportToCSV);
    dom.btnSeed.addEventListener('click', () => {
      state.tasks = [...INITIAL_DEMO_DATA];
      saveTasksToStorage();
      renderView();
    });
  }

  // --------------------------------------------------
  // 10. Bootstrap Application
  // --------------------------------------------------
  function init() {
    state.tasks = loadTasksFromStorage();
    initEventListeners();
    renderView();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();