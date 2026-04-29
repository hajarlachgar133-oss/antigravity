/* ============================================================
   NEXUSIT — UTILITIES MODULE
   ─────────────────────────────────────────────────────────────
   Shared helper functions used by all feature modules.
   
   Improvements:
   - Added XSS-safe text escaping helper
   - Improved debounce with cancel support
   - Better animateCount with easing
   - Toast auto-dismissal uses CSS animation end event
   ============================================================ */

/**
 * Show a toast notification with auto-dismiss.
 * @param {string} msg  — Notification message text
 * @param {'success'|'error'|'info'} type — Visual style
 */
function toast(msg, type = 'info', duration = 3500) {
  const icons = {
    success : 'fa-circle-check',
    error   : 'fa-circle-xmark',
    info    : 'fa-circle-info',
    warning : 'fa-triangle-exclamation',
  };

  const icon = icons[type] || icons.info;
  const $toast = $(`
    <div class="toast ${type}">
      <i class="fa ${icon}"></i>
      <span style="flex:1">${msg}</span>
    </div>
  `).appendTo('#toasts');

  const hideDelay = duration - 300;
  setTimeout(() => $toast.addClass('toast-out'), Math.max(hideDelay, 100));
  setTimeout(() => $toast.remove(), duration);
}


/**
 * Return a coloured status badge as an HTML string.
 * Centralizes badge generation for consistent UI across all modules.
 * @param {string} status — Status key
 * @returns {string} Badge HTML
 */
function badgeFor(status) {
  const map = {
    // ── Inventory statuses (DB ENUM values) ──────────────────
    'active'         : '<span class="badge badge-green">Active</span>',
    'inactive'       : '<span class="badge badge-red">Inactive</span>',
    'maintenance'    : '<span class="badge badge-yellow">Maintenance</span>',
    'retired'        : '<span class="badge badge-red">Retired</span>',
    // ── Legacy capitalised values ────────────────────────────
    'Active'         : '<span class="badge badge-green">Active</span>',
    'Inactive'       : '<span class="badge badge-red">Inactive</span>',
    'Maintenance'    : '<span class="badge badge-yellow">Maintenance</span>',
    'Decommissioned' : '<span class="badge badge-red">Decommissioned</span>',
    // ── Issue / ticket statuses ──────────────────────────────
    'resolved'       : '<span class="badge badge-green">Resolved</span>',
    'pending'        : '<span class="badge badge-yellow">Pending</span>',
    'in-progress'    : '<span class="badge badge-blue">In Progress</span>',
    'in_progress'    : '<span class="badge badge-blue">In Progress</span>',
    'critical'       : '<span class="badge badge-red">Critical</span>',
    // ── Request / ticket statuses ────────────────────────────
    'open'           : '<span class="badge badge-blue">Open</span>',
    'Open'           : '<span class="badge badge-blue">Open</span>',
    'In Progress'    : '<span class="badge badge-blue">In Progress</span>',
    'In Review'      : '<span class="badge badge-blue">In Review</span>',
    'Resolved'       : '<span class="badge badge-green">Resolved</span>',
    'Closed'         : '<span class="badge badge-red">Closed</span>',
    'Rejected'       : '<span class="badge badge-red">Rejected</span>',
    'cancelled'      : '<span class="badge badge-red">Cancelled</span>',
  };
  return map[status] || `<span class="badge">${escapeHTML(String(status ?? ''))}</span>`;
}


/**
 * Get current time formatted as HH:MM.
 * @returns {string}
 */
function currentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


/**
 * Debounce a function call with optional cancel.
 * @param {Function} fn    — Function to debounce
 * @param {number}   delay — Delay in milliseconds
 * @returns {Function} Debounced function (call .cancel() to abort)
 */
function debounce(fn, delay = 250) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}


/**
 * Animate a numeric counter from 0 to a target value.
 * Uses ease-out cubic for a satisfying deceleration effect.
 * @param {jQuery} $el      — Target jQuery element
 * @param {number} end      — Target value
 * @param {number} duration — Animation duration in ms
 */
function animateCount($el, end, duration = 800) {
  if (!$el.length) return;
  if (end === 0) { $el.text(0); return; }

  const startTime = performance.now();
  const startVal  = parseInt($el.text(), 10) || 0;
  const range     = end - startVal;

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic for natural deceleration
    const eased    = 1 - Math.pow(1 - progress, 3);
    $el.text(Math.round(startVal + range * eased));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}


/**
 * Escape HTML special characters to prevent XSS.
 * Use this when inserting user-provided text into the DOM.
 * @param {string} str — Raw string
 * @returns {string} Escaped string safe for innerHTML
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}


/**
 * Format an ISO date string into a human-readable local format.
 * @param {string} dateStr — ISO 8601 or MySQL DATETIME string
 * @returns {string} Formatted date like "Apr 10, 2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}


/**
 * Format a number with thousands separators.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return Number(n).toLocaleString();
}


/**
 * Highlight a form field with an error style for 2 seconds.
 * Available globally to all modules (inventory, docs, requests, settings).
 * @param {string} selector — jQuery selector of the input element
 */
function highlightField(selector) {
  const $el = $(selector);
  $el.addClass('input-error').trigger('focus');
  setTimeout(() => $el.removeClass('input-error'), 2000);
}
