/* ============================================================
   NEXUSIT — API CLIENT  (api.js)
   ─────────────────────────────────────────────────────────────
   Central HTTP wrapper for all backend calls.
   All modules import from this object instead of touching
   localStorage directly.
   ============================================================ */

let origin = window.location.origin;
if (origin === "null" || origin === "file://" || window.location.port === "5500" || window.location.port === "3000") {
  const host = window.location.hostname || "127.0.0.1";
  origin = `http://${host}`;
}
const BASE = origin + '/ocp/api';

const Api = {

  /* —— Generic fetch wrapper — with timeout + retry —————————— */
  async _req(url, method = 'GET', body = null, { retries = 1, timeout = 10000 } = {}) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      opts.signal = controller.signal;

      try {
        const res  = await fetch(url, opts);
        clearTimeout(timer);
        const text = await res.text();

        if (!text || text.trim() === '') {
          throw new Error('Server returned an empty response. Verify PHP and MySQL are running.');
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch {
          console.error('[NexusIT API] Non-JSON response:', text.substring(0, 300));
          throw new Error('Server configuration error. Verify the database is accessible.');
        }

        // Retry on 5xx if attempts remain
        if (res.status >= 500 && attempt < retries) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }

        if (!json.success) throw new Error(json.error || 'Server error');
        return json.data ?? json;

      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection.');
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        console.error('[NexusIT API]', url, err);
        throw err;
      }
    }
  },

  /* ── AUTH ──────────────────────────────────────────────── */
  login    : (email, password)   => Api._req(`${BASE}/auth.php?action=login`,    'POST', { email, password }),
  register : (data)              => Api._req(`${BASE}/auth.php?action=register`,  'POST', data),
  logout   : ()                  => Api._req(`${BASE}/auth.php?action=logout`,    'POST'),
  me       : ()                  => Api._req(`${BASE}/auth.php?action=me`,        'GET'),
  updateProfile: (data)          => Api._req(`${BASE}/auth.php?action=profile`,   'PUT',  data),

  /* ── DASHBOARD ─────────────────────────────────────────── */
  dashboard: () => Api._req(`${BASE}/dashboard.php`, 'GET'),

  /* ── INVENTORY ─────────────────────────────────────────── */
  getInventory  : (q = '')  => Api._req(`${BASE}/inventory.php?q=${encodeURIComponent(q)}`),
  addAsset      : (data)    => Api._req(`${BASE}/inventory.php`,          'POST',   data),
  updateAsset   : (id, data)=> Api._req(`${BASE}/inventory.php?id=${id}`, 'PUT',    data),
  deleteAsset   : (id)      => Api._req(`${BASE}/inventory.php?id=${id}`, 'DELETE'),

  /* ── TICKETS (troubleshooting issues) ──────────────────── */
  getTickets    : (q='',st='') => Api._req(`${BASE}/tickets.php?q=${encodeURIComponent(q)}&status=${st}`),
  addTicket     : (data)       => Api._req(`${BASE}/tickets.php`,          'POST',   data),
  updateTicket  : (id, data)   => Api._req(`${BASE}/tickets.php?id=${id}`, 'PUT',    data),
  deleteTicket  : (id)         => Api._req(`${BASE}/tickets.php?id=${id}`, 'DELETE'),

  /* ── USER TICKETS (employee portal) ────────────────────── */
  getUserTickets   : ()         => Api._req(`${BASE}/user_tickets.php`),
  submitUserTicket : (data)     => Api._req(`${BASE}/user_tickets.php`,          'POST', data),
  updateUserTicket : (id, data) => Api._req(`${BASE}/user_tickets.php?id=${id}`, 'PUT',  data),

  /* ── REQUESTS & COMPLAINTS ─────────────────────────────── */
  getRequests   : ()         => Api._req(`${BASE}/requests.php`),
  addRequest    : (data)     => Api._req(`${BASE}/requests.php`,          'POST',   data),
  updateRequest : (id, data) => Api._req(`${BASE}/requests.php?id=${id}`, 'PUT',    data),
  deleteRequest : (id)       => Api._req(`${BASE}/requests.php?id=${id}`, 'DELETE'),

  /* ── DOCUMENTATION ─────────────────────────────────────── */
  getDocs   : (q='',cat='') => Api._req(`${BASE}/docs.php?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`),
  addDoc    : (data)        => Api._req(`${BASE}/docs.php`,          'POST',   data),
  updateDoc : (id, data)    => Api._req(`${BASE}/docs.php?id=${id}`, 'PUT',    data),
  deleteDoc : (id)          => Api._req(`${BASE}/docs.php?id=${id}`, 'DELETE'),

  /* ── SETTINGS (admin) ───────────────────────────────────── */
  getSettings   : ()     => Api._req(`${BASE}/settings.php?action=profile`),
  saveSettings  : (data) => Api._req(`${BASE}/settings.php?action=profile`, 'PUT',  data),
  clearAllData  : ()     => Api._req(`${BASE}/settings.php?action=clear`,   'POST'),
};
