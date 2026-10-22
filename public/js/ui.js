/**
 * SocietyHub — SHUI Design System Runtime (ui.js)
 * ─────────────────────────────────────────────────
 * Shared UI helpers every portal page codes against: window.SHUI
 *
 * Contract:
 *   escapeHtml, formatINR, formatDate, formatDateTime, timeAgo,
 *   badge(label,tone), statusBadge(status), toast(msg,type),
 *   confirm({title,message,confirmText,danger}) → Promise<boolean>,
 *   emptyState({icon,title,subtitle,actionHtml}), skeletonHtml(rows),
 *   renderTable(el,{columns,rows,pageSize,searchKeys,emptyState}) → {refresh},
 *   pageHeader({title,subtitle,actionsHtml}), statCard({label,value,sub,icon,tone}),
 *   chartColors(), initQR(el,text)
 *
 * Load order: after bootstrap bundle + db.js, before notifications.js.
 * No external dependencies — works offline, no CDN beyond what pages load.
 */

(function (global) {
  'use strict';

  /* ════════════════════════════════════════════
     Internal utilities
     ════════════════════════════════════════════ */

  var BADGE_TONES = ['primary', 'success', 'warning', 'danger', 'info', 'secondary', 'navy'];

  var STATUS_TONE_MAP = {
    /* success */
    'Paid': 'success',
    'Approved': 'success',
    'Resolved': 'success',
    'Confirmed': 'success',
    'Active': 'success',
    'Occupied': 'success',
    'Checked Out': 'success',
    'Owner Occupied': 'success',
    'Rented': 'success',
    /* warning */
    'Pending': 'warning',
    'Open': 'warning',
    'Unpaid': 'warning',
    'Waiting': 'warning',
    'Vacant': 'warning',
    /* danger */
    'Rejected': 'danger',
    'Suspended': 'danger',
    'Overdue': 'danger',
    'Cancelled': 'danger',
    /* info */
    'In Progress': 'info',
    'Assigned': 'info',
    'Under Maintenance': 'info',
    /* primary */
    'Closed': 'primary',
    'Checked In': 'primary',
    /* secondary-navy */
    'Emergency': 'navy',
    'Critical': 'navy'
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    if (typeof d === 'number') {
      var dn = new Date(d);
      return isNaN(dn.getTime()) ? null : dn;
    }
    var s = String(d).trim();
    if (!s) return null;
    // Make 'YYYY-MM-DD HH:mm:ss' Safari-safe
    if (/^\d{4}-\d{2}-\d{2}[ T]/.test(s)) s = s.replace(' ', 'T');
    var dt = new Date(s);
    if (isNaN(dt.getTime())) dt = new Date(String(d).replace(/-/g, '/'));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function normalizeIconClass(icon, fallback) {
    var i = String(icon || '').trim();
    if (!i) i = fallback || 'fa-solid fa-circle';
    // Allow passing bare icon names like 'fa-inbox'
    if (/^fa-[a-z0-9-]+$/i.test(i)) i = 'fa-solid ' + i;
    return i;
  }

  function sanitizeTone(tone) {
    return BADGE_TONES.indexOf(tone) !== -1 ? tone : 'secondary';
  }

  function resolveEl(el) {
    if (!el) return null;
    if (typeof el === 'string') return document.querySelector(el);
    if (el.nodeType === 1) return el;
    return null;
  }

  function cssVar(name, fallback) {
    try {
      var v = global.getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* ════════════════════════════════════════════
     Formatting helpers
     ════════════════════════════════════════════ */

  /** ₹ Indian-grouping currency. formatINR(125000) → "₹1,25,000" */
  function formatINR(amount) {
    var n = toNumber(amount);
    var opts = (n % 1 === 0)
      ? undefined
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    try {
      return '₹' + n.toLocaleString('en-IN', opts);
    } catch (e) {
      return '₹' + n;
    }
  }

  /** "2026-08-26" | Date | epoch → "26 Aug 2026" (returns "—" when invalid) */
  function formatDate(d) {
    var dt = parseDate(d);
    if (!dt) return '—';
    try {
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dt.toDateString();
    }
  }

  /** → "26 Aug 2026, 10:15 am" */
  function formatDateTime(d) {
    var dt = parseDate(d);
    if (!dt) return '—';
    try {
      var date = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      var time = dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      return date + ', ' + time;
    } catch (e) {
      return dt.toString();
    }
  }

  /** Relative time: "just now", "5 min ago", "3 hr ago", "2 days ago", else date */
  function timeAgo(d) {
    var dt = parseDate(d);
    if (!dt) return '—';
    var diff = Date.now() - dt.getTime();
    if (diff < 0) diff = 0;
    var sec = Math.floor(diff / 1000);
    if (sec < 45) return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' min ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + (hr === 1 ? ' hr ago' : ' hr ago');
    var day = Math.floor(hr / 24);
    if (day < 7) return day + (day === 1 ? ' day ago' : ' days ago');
    return formatDate(dt);
  }

  /* ════════════════════════════════════════════
     Badges
     ════════════════════════════════════════════ */

  /** Soft pill badge. tone: primary|success|warning|danger|info|secondary|navy */
  function badge(label, tone) {
    return '<span class="sh-badge sh-badge--' + sanitizeTone(tone) + '">' + escapeHtml(label) + '</span>';
  }

  /** Status → toned badge using the shared SocietyHub status vocabulary. */
  function statusBadge(status) {
    var s = String(status === null || status === undefined ? '' : status).trim();
    var tone = STATUS_TONE_MAP[s];
    if (!tone) {
      // Case-insensitive fallback lookup
      var lower = s.toLowerCase();
      for (var key in STATUS_TONE_MAP) {
        if (Object.prototype.hasOwnProperty.call(STATUS_TONE_MAP, key) && key.toLowerCase() === lower) {
          tone = STATUS_TONE_MAP[key];
          break;
        }
      }
    }
    if (!tone) tone = 'secondary';
    return badge(s || 'Unknown', tone);
  }

  /** Complaint vocabulary normalizer: legacy 'Pending' renders as 'Open'. */
  function normalizeComplaintStatus(status) {
    var s = String(status === null || status === undefined ? '' : status).trim();
    return s.toLowerCase() === 'pending' ? 'Open' : s;
  }

  /* ════════════════════════════════════════════
     Toast
     ════════════════════════════════════════════ */

  /**
   * Toast a message. Delegates to the global showToast() from notifications.js
   * when present; otherwise renders an equivalent toast locally.
   * Message is treated as TEXT and escaped.
   */
  function toast(msg, type) {
    var t = type || 'success';
    var safe = escapeHtml(msg);
    if (typeof global.showToast === 'function') {
      global.showToast(safe, t);
      return;
    }
    /* Local fallback renderer */
    var container = document.getElementById('globalToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalToastContainer';
      container.className = 'toast-container-custom';
      document.body.appendChild(container);
    }
    var icon = t === 'success' ? 'fa-circle-check text-success'
      : t === 'error' ? 'fa-circle-xmark text-danger'
      : t === 'warning' ? 'fa-triangle-exclamation text-warning'
      : 'fa-bell text-primary';
    var el = document.createElement('div');
    el.className = 'toast-custom ' + t;
    el.innerHTML =
      '<i class="fa-solid ' + icon + ' fs-5"></i>' +
      '<div class="flex-grow-1">' + safe + '</div>' +
      '<button type="button" class="btn-close ms-2" style="font-size:10px;" aria-label="Close"></button>';
    el.querySelector('.btn-close').addEventListener('click', function () { el.remove(); });
    container.appendChild(el);
    setTimeout(function () {
      el.style.animation = 'fadeOutRight 0.3s ease forwards';
      setTimeout(function () { el.remove(); }, 300);
    }, 3800);
  }

  /* ════════════════════════════════════════════
     Confirm modal (Bootstrap-based, Promise<boolean>)
     ════════════════════════════════════════════ */

  function confirm(opts) {
    opts = opts || {};
    var title = opts.title || 'Are you sure?';
    var message = opts.message || '';
    var confirmText = opts.confirmText || 'Confirm';
    var danger = !!opts.danger;

    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      }

      var id = 'shConfirmModal_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      var wrapper = document.createElement('div');
      wrapper.innerHTML =
        '<div class="modal fade" id="' + id + '" tabindex="-1" aria-hidden="true">' +
        '  <div class="modal-dialog modal-dialog-centered">' +
        '    <div class="modal-content" style="border-radius: var(--radius-xl, 20px);">' +
        '      <div class="modal-body text-center p-4 p-md-5">' +
        '        <div class="sh-confirm-icon ' + (danger ? 'sh-confirm-icon--danger' : 'sh-confirm-icon--primary') + '">' +
        '          <i class="fa-solid ' + (danger ? 'fa-triangle-exclamation' : 'fa-circle-question') + '"></i>' +
        '        </div>' +
        '        <h5 class="fw-bold mb-2">' + escapeHtml(title) + '</h5>' +
        (message ? '<p class="text-muted mb-4" style="font-size:14px;">' + escapeHtml(message) + '</p>' : '<div class="mb-4"></div>') +
        '        <div class="d-flex gap-2 justify-content-center flex-wrap">' +
        '          <button type="button" class="btn btn-light rounded-pill px-4" data-sh-cancel style="border:1px solid var(--border-color, #E2E8F0);">Cancel</button>' +
        '          <button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' rounded-pill px-4" data-sh-ok>' + escapeHtml(confirmText) + '</button>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      var modalEl = wrapper.firstChild;
      document.body.appendChild(modalEl);

      function cleanup() {
        setTimeout(function () {
          if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
          var backdrops = document.querySelectorAll('.modal-backdrop');
          // Remove any orphaned backdrop left without Bootstrap
          backdrops.forEach(function (b) {
            if (!document.querySelector('.modal.show')) b.remove();
          });
        }, 200);
      }

      var bsModal = null;
      if (global.bootstrap && global.bootstrap.Modal) {
        bsModal = new global.bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
        modalEl.addEventListener('hidden.bs.modal', function () {
          done(false);
          cleanup();
        });
        modalEl.querySelector('[data-sh-ok]').addEventListener('click', function () {
          done(true);
          bsModal.hide();
        });
        modalEl.querySelector('[data-sh-cancel]').addEventListener('click', function () {
          bsModal.hide();
        });
        bsModal.show();
      } else {
        /* Minimal fallback without Bootstrap JS */
        var backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop show';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(7,13,26,0.65);z-index:1050;';
        modalEl.classList.add('show');
        modalEl.style.cssText = 'display:block;position:fixed;inset:0;z-index:1060;overflow-y:auto;';
        document.body.appendChild(backdrop);
        var closeFallback = function () {
          backdrop.remove();
          modalEl.remove();
        };
        modalEl.querySelector('[data-sh-ok]').addEventListener('click', function () {
          done(true);
          closeFallback();
        });
        modalEl.querySelector('[data-sh-cancel]').addEventListener('click', function () {
          done(false);
          closeFallback();
        });
        backdrop.addEventListener('click', function () {
          done(false);
          closeFallback();
        });
      }

      // Focus the confirm action for keyboard users
      try { modalEl.querySelector('[data-sh-ok]').focus(); } catch (e) { /* noop */ }
    });
  }

  /* ════════════════════════════════════════════
     Empty state & skeletons
     ════════════════════════════════════════════ */

  /** Centered icon + title + subtitle (+ optional action buttons HTML). */
  function emptyState(opts) {
    opts = opts || {};
    var icon = normalizeIconClass(opts.icon, 'fa-solid fa-inbox');
    var title = opts.title || 'Nothing here yet';
    var subtitle = opts.subtitle || '';
    var actionHtml = opts.actionHtml || '';
    return (
      '<div class="sh-empty">' +
      '  <i class="' + escapeHtml(icon) + ' sh-empty__icon"></i>' +
      '  <h6 class="sh-empty__title">' + escapeHtml(title) + '</h6>' +
      (subtitle ? '  <p class="sh-empty__sub">' + escapeHtml(subtitle) + '</p>' : '') +
      (actionHtml ? '  <div class="sh-empty__action">' + actionHtml + '</div>' : '') +
      '</div>'
    );
  }

  /** Shimmering placeholder rows for first-render loading states. */
  function skeletonHtml(rows) {
    var count = Math.max(1, Math.min(20, parseInt(rows, 10) || 3));
    var widths = [92, 78, 85, 64, 88, 71];
    var html = '<div class="sh-skeleton sh-skeleton--title" aria-hidden="true"></div>';
    for (var i = 0; i < count; i++) {
      html += '<div class="sh-skeleton sh-skeleton--text" style="width:' + widths[i % widths.length] + '%" aria-hidden="true"></div>';
    }
    return html;
  }

  /* ════════════════════════════════════════════
     Data table renderer (search / sort / pagination)
     ════════════════════════════════════════════ */

  function compareValues(a, b) {
    var aNull = a === null || a === undefined || a === '';
    var bNull = b === null || b === undefined || b === '';
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    var an = Number(a);
    var bn = Number(b);
    if (!isNaN(an) && !isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') {
      return an - bn;
    }

    var ad = parseDate(a);
    var bd = parseDate(b);
    if (ad && bd) return ad.getTime() - bd.getTime();

    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
  }

  /**
   * renderTable(el, {
   *   columns: [{ key, label, sortable, render(row) }],
   *   rows: [...], pageSize: 10,
   *   searchKeys: ['name','flat'] | true,
   *   emptyState: {icon,title,subtitle}
   * }) → { refresh(newRows) }
   */
  function renderTable(el, opts) {
    var noopApi = { refresh: function () {} };
    var host = resolveEl(el);
    if (!host) {
      console.error('[SHUI.renderTable] target element not found', el);
      return noopApi;
    }
    opts = opts || {};
    var columns = Array.isArray(opts.columns) ? opts.columns : [];
    if (!columns.length) {
      console.error('[SHUI.renderTable] columns are required');
      host.innerHTML = emptyState({ icon: 'fa-triangle-exclamation', title: 'Table misconfigured', subtitle: 'No columns were provided for this table.' });
      return noopApi;
    }

    var state = {
      rows: Array.isArray(opts.rows) ? opts.rows.slice() : [],
      query: '',
      sortKey: null,
      sortDir: 'asc',
      page: 1,
      pageSize: Math.max(1, parseInt(opts.pageSize, 10) || 10)
    };

    var searchKeys = null;
    if (Array.isArray(opts.searchKeys) && opts.searchKeys.length) {
      searchKeys = opts.searchKeys;
    } else if (opts.searchKeys === true || opts.searchKeys === undefined) {
      searchKeys = columns.map(function (c) { return c.key; }).filter(Boolean);
    }

    var uid = 'shTable_' + Math.random().toString(36).slice(2, 9);

    function getFilteredRows() {
      var rows = state.rows;
      var q = state.query.trim().toLowerCase();
      if (q && searchKeys && searchKeys.length) {
        rows = rows.filter(function (row) {
          return searchKeys.some(function (key) {
            var v = row ? row[key] : '';
            return v !== null && v !== undefined && String(v).toLowerCase().indexOf(q) !== -1;
          });
        });
      }
      if (state.sortKey) {
        var dir = state.sortDir === 'desc' ? -1 : 1;
        rows = rows.slice().sort(function (a, b) {
          return dir * compareValues(a ? a[state.sortKey] : null, b ? b[state.sortKey] : null);
        });
      }
      return rows;
    }

    function buildShell() {
      var searchable = !!(searchKeys && searchKeys.length);
      var html = '';
      if (searchable) {
        html +=
          '<div class="sh-table-toolbar">' +
          '  <div class="sh-table-search">' +
          '    <i class="fa-solid fa-magnifying-glass"></i>' +
          '    <input type="search" id="' + uid + '_search" placeholder="Search…" aria-label="Search table">' +
          '  </div>' +
          '  <span class="caption-text fs-8" id="' + uid + '_count"></span>' +
          '</div>';
      }
      html += '<div class="sh-table-wrap"><table class="sh-table" id="' + uid + '_table"></table></div>';
      html += '<div class="sh-table-footer" id="' + uid + '_footer"></div>';
      host.innerHTML = html;

      if (searchable) {
        var input = document.getElementById(uid + '_search');
        var debounceTimer = null;
        input.addEventListener('input', function () {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            state.query = input.value;
            state.page = 1;
            renderBody();
          }, 150);
        });
      }
    }

    function renderHead() {
      var table = document.getElementById(uid + '_table');
      if (!table) return;
      var headHtml = '<thead><tr>';
      columns.forEach(function (col) {
        var sortable = col.sortable !== false && col.key;
        var isSorted = state.sortKey === col.key;
        var icon = isSorted
          ? (state.sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down')
          : 'fa-sort';
        headHtml += '<th scope="col"' +
          (sortable ? ' class="sh-th-sortable' + (isSorted ? ' sh-sorted' : '') + '" data-sh-key="' + escapeHtml(col.key) + '" tabindex="0" role="button"' : '') +
          ' aria-sort="' + (isSorted ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none') + '">' +
          escapeHtml(col.label || col.key || '') +
          (sortable ? '<i class="fa-solid ' + icon + ' sh-sort-icon"></i>' : '') +
          '</th>';
      });
      headHtml += '</tr></thead>';

      // Keep tbody placeholder; body rendered separately
      var existingHead = table.querySelector('thead');
      if (existingHead) existingHead.remove();
      table.insertAdjacentHTML('afterbegin', headHtml);

      table.querySelectorAll('th.sh-th-sortable').forEach(function (th) {
        var handler = function () {
          var key = th.getAttribute('data-sh-key');
          if (state.sortKey === key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortKey = key;
            state.sortDir = 'asc';
          }
          renderHead();
          renderBody();
        };
        th.addEventListener('click', handler);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler();
          }
        });
      });
    }

    function renderBody() {
      var table = document.getElementById(uid + '_table');
      if (!table) return;

      var filtered = getFilteredRows();
      var total = filtered.length;
      var totalPages = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
      var start = (state.page - 1) * state.pageSize;
      var end = Math.min(total, start + state.pageSize);
      var pageRows = filtered.slice(start, end);

      var bodyHtml = '<tbody>';
      if (!total) {
        bodyHtml += '<tr><td colspan="' + columns.length + '" style="padding:0;border:none;">' +
          emptyState(opts.emptyState || { icon: 'fa-inbox', title: 'No records found', subtitle: state.query ? 'Nothing matches your search. Try different keywords.' : 'There is nothing to display here yet.' }) +
          '</td></tr>';
      } else {
        pageRows.forEach(function (row) {
          bodyHtml += '<tr>';
          columns.forEach(function (col) {
            var cell;
            try {
              cell = typeof col.render === 'function' ? col.render(row) : escapeHtml(row ? row[col.key] : '');
            } catch (e) {
              cell = escapeHtml(row ? row[col.key] : '');
            }
            if (cell === null || cell === undefined) cell = '';
            bodyHtml += '<td>' + cell + '</td>';
          });
          bodyHtml += '</tr>';
        });
      }
      bodyHtml += '</tbody>';

      var existingBody = table.querySelector('tbody');
      if (existingBody) existingBody.remove();
      table.insertAdjacentHTML('beforeend', bodyHtml);

      /* Footer: Showing x–y of z + Prev/Next */
      var footer = document.getElementById(uid + '_footer');
      if (footer) {
        if (total <= state.pageSize && !state.query) {
          footer.style.display = 'none';
        } else {
          footer.style.display = '';
          footer.innerHTML =
            '<span>' + (total ? 'Showing ' + (start + 1) + '–' + end + ' of ' + total : '0 results') + '</span>' +
            '<div class="sh-table-pager">' +
            '  <button type="button" class="btn btn-outline-secondary btn-sm" data-sh-prev ' + (state.page <= 1 ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left me-1"></i>Prev</button>' +
            '  <span class="caption-text">Page ' + state.page + ' / ' + totalPages + '</span>' +
            '  <button type="button" class="btn btn-outline-secondary btn-sm" data-sh-next ' + (state.page >= totalPages ? 'disabled' : '') + '>Next<i class="fa-solid fa-chevron-right ms-1"></i></button>' +
            '</div>';
          var prev = footer.querySelector('[data-sh-prev]');
          var next = footer.querySelector('[data-sh-next]');
          if (prev) prev.addEventListener('click', function () {
            if (state.page > 1) { state.page--; renderBody(); }
          });
          if (next) next.addEventListener('click', function () {
            if (state.page < totalPages) { state.page++; renderBody(); }
          });
        }
      }

      var countEl = document.getElementById(uid + '_count');
      if (countEl) countEl.textContent = total + (total === 1 ? ' record' : ' records');
    }

    try {
      buildShell();
      renderHead();
      renderBody();
    } catch (err) {
      console.error('[SHUI.renderTable] render failed', err);
      host.innerHTML = emptyState({ icon: 'fa-triangle-exclamation', title: 'Could not load this table', subtitle: 'An unexpected error occurred while rendering the data.' });
      return noopApi;
    }

    return {
      refresh: function (newRows) {
        if (Array.isArray(newRows)) {
          state.rows = newRows.slice();
          state.page = 1;
        }
        try {
          renderHead();
          renderBody();
        } catch (err) {
          console.error('[SHUI.renderTable] refresh failed', err);
        }
      }
    };
  }

  /* ════════════════════════════════════════════
     Page scaffolding blocks
     ════════════════════════════════════════════ */

  /** Page heading with optional subtitle + action buttons (raw HTML). */
  function pageHeader(opts) {
    opts = opts || {};
    var actions = opts.actionsHtml || '';
    return (
      '<div class="sh-page-title fade-up">' +
      '  <div>' +
      '    <h1 class="sh-page-title__title">' + escapeHtml(opts.title || '') + '</h1>' +
      (opts.subtitle ? '    <span class="sh-page-title__sub">' + escapeHtml(opts.subtitle) + '</span>' : '') +
      '  </div>' +
      (actions ? '  <div class="sh-page-title__actions">' + actions + '</div>' : '') +
      '</div>'
    );
  }

  /** KPI stat card. tone: primary|success|warning|danger|info|navy */
  function statCard(opts) {
    opts = opts || {};
    var tone = ['primary', 'success', 'warning', 'danger', 'info', 'navy'].indexOf(opts.tone) !== -1 ? opts.tone : 'primary';
    var icon = normalizeIconClass(opts.icon, 'fa-solid fa-chart-simple');
    var sub = opts.sub || '';
    return (
      '<div class="sh-kpi sh-kpi--' + tone + ' fade-up">' +
      '  <div class="sh-kpi__icon"><i class="' + escapeHtml(icon) + '"></i></div>' +
      '  <div class="sh-kpi__body">' +
      '    <p class="sh-kpi__label">' + escapeHtml(opts.label || '') + '</p>' +
      '    <div class="sh-kpi__value">' + escapeHtml(opts.value === null || opts.value === undefined ? '—' : opts.value) + '</div>' +
      (sub ? '    <div class="sh-kpi__sub">' + escapeHtml(sub) + '</div>' : '') +
      '  </div>' +
      '</div>'
    );
  }

  /* ════════════════════════════════════════════
     Chart palette (reads CSS vars, theme-aware)
     ════════════════════════════════════════════ */

  function chartColors() {
    var primary = cssVar('--accent-primary', '#2563EB');
    var success = cssVar('--accent-success', '#10B981');
    var warning = cssVar('--accent-warning', '#F59E0B');
    var danger = cssVar('--accent-danger', '#EF4444');
    var info = cssVar('--accent-info', '#0EA5E9');
    var navy = cssVar('--accent-primary-dark', '#1E40AF');
    var purple = cssVar('--accent-purple', '#1D4ED8');
    return {
      primary: primary,
      blue: primary,
      success: success,
      warning: warning,
      danger: danger,
      info: info,
      navy: navy,
      purple: purple,
      text: cssVar('--text-primary', '#334155'),
      heading: cssVar('--text-heading', '#0F172A'),
      muted: cssVar('--text-muted', '#64748B'),
      grid: cssVar('--border-color', '#E2E8F0'),
      card: cssVar('--bg-card', '#FFFFFF'),
      palette: [primary, success, warning, info, danger, navy, purple, '#8B5CF6']
    };
  }

  /* ════════════════════════════════════════════
     Offline deterministic pseudo-QR (SVG)
     ════════════════════════════════════════════ */

  function fnv1aHash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * initQR(el, text) — renders a deterministic QR-style SVG gate pass into el.
   * Same text always produces the same pattern (offline, no CDN).
   */
  function initQR(el, text) {
    var host = resolveEl(el);
    if (!host) {
      console.error('[SHUI.initQR] target element not found', el);
      return;
    }
    var payload = String(text === null || text === undefined ? '' : text);
    if (!payload) {
      host.innerHTML = '<span class="caption-text">No code available</span>';
      return;
    }
    if (host.classList && !host.classList.contains('sh-qr')) host.classList.add('sh-qr');

    var N = 25;            // modules per side
    var MODULE = 6;        // px per module
    var QUIET = 2;         // quiet-zone modules
    var SIZE = (N + QUIET * 2) * MODULE;

    var seed = fnv1aHash(payload);
    var rand = mulberry32(seed);

    // Build module matrix
    var grid = [];
    for (var r = 0; r < N; r++) {
      grid.push([]);
      for (var c = 0; c < N; c++) {
        grid[r].push(rand() < 0.48 ? 1 : 0);
      }
    }

    // Finder pattern (7x7) at three corners, like a real QR code
    function drawFinder(r0, c0) {
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 7; c++) {
          var outer = (r === 0 || r === 6 || c === 0 || c === 6);
          var inner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          grid[r0 + r][c0 + c] = (outer || inner) ? 1 : 0;
        }
      }
      // Separator ring stays light
      for (var i = -1; i < 8; i++) {
        var rr = r0 + i, cc1 = c0 - 1, cc2 = c0 + 7;
        if (rr >= 0 && rr < N) {
          if (cc1 >= 0) grid[rr][cc1] = 0;
          if (cc2 < N) grid[rr][cc2] = 0;
        }
        var cc = c0 + i, rr1 = r0 - 1, rr2 = r0 + 7;
        if (cc >= 0 && cc < N) {
          if (rr1 >= 0) grid[rr1][cc] = 0;
          if (rr2 < N) grid[rr2][cc] = 0;
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    // Timing patterns (alternating) on row/col 6
    for (var t = 8; t < N - 8; t++) {
      var bit = (t % 2 === 0) ? 1 : 0;
      grid[6][t] = bit;
      grid[t][6] = bit;
    }

    // Compose SVG (dark modules on white)
    var rects = '';
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        if (grid[y][x]) {
          rects += '<rect x="' + ((x + QUIET) * MODULE) + '" y="' + ((y + QUIET) * MODULE) +
            '" width="' + MODULE + '" height="' + MODULE + '"/>';
        }
      }
    }
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + SIZE + '" height="' + SIZE +
      '" viewBox="0 0 ' + SIZE + ' ' + SIZE + '" role="img" aria-label="Gate pass code">' +
      '<rect width="' + SIZE + '" height="' + SIZE + '" fill="#FFFFFF"/>' +
      '<g fill="#0F172A">' + rects + '</g></svg>';

    // Human-readable code derived from the same hash (deterministic)
    var code = seed.toString(36).toUpperCase();
    while (code.length < 8) code = '0' + code;
    code = code.slice(0, 8);
    var readable = 'SH-' + code.slice(0, 4) + '-' + code.slice(4);

    host.innerHTML =
      svg +
      '<span class="sh-qr__code">' + escapeHtml(readable) + '</span>' +
      '<span class="sh-qr__label">Show this code at the gate</span>';
  }

  /* ════════════════════════════════════════════
     Public API
     ════════════════════════════════════════════ */

  var SHUI = {
    version: '1.0.0',
    escapeHtml: escapeHtml,
    formatINR: formatINR,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    timeAgo: timeAgo,
    badge: badge,
    statusBadge: statusBadge,
    normalizeComplaintStatus: normalizeComplaintStatus,
    toast: toast,
    confirm: confirm,
    emptyState: emptyState,
    skeletonHtml: skeletonHtml,
    renderTable: renderTable,
    pageHeader: pageHeader,
    statCard: statCard,
    chartColors: chartColors,
    initQR: initQR
  };

  global.SHUI = SHUI;

})(typeof window !== 'undefined' ? window : this);
