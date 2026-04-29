/* ============================================================
   NEXUSIT — DATA MODULE  (data.js)  — DB-connected version
   ─────────────────────────────────────────────────────────────
   In-memory stores populated from the API on boot.
   safeGetJSON / safeSetJSON kept for legacy utility usage only.
   ============================================================ */

/* —— In-memory stores (filled by API calls) ————————————— */
let inventory   = [];
let tickets     = [];   // troubleshooting issues
let serviceReqs = [];
let docs        = [];

/* —— Chatbot reply pool ——————————————————————————————————— */
const BOT_REPLIES = [
  "I'm checking that for you right now — please give me a moment.",
  "I've logged your request and it has been escalated to the relevant team.",
  "According to our records, this issue was last seen 3 days ago and was resolved by restarting the affected service.",
  "Can you provide the serial number or hostname of the device you're referring to?",
  "I've created a support ticket for this issue. A technician will contact you shortly.",
  "Based on the symptoms you've described, this sounds like a DNS resolution problem. Try flushing your DNS cache: <code>ipconfig /flushdns</code>",
  "Our monitoring system shows all critical services are currently operational. The issue might be isolated to your endpoint.",
  "I'll run a remote diagnostic on that device. Please stay connected — this usually takes under 2 minutes.",
  "The maintenance window for that system is scheduled for Saturday 02:00–04:00 UTC. You'll receive email confirmation.",
  "Our knowledge base has an article on exactly this topic. Let me pull up the key steps for you.",
];

/* —— Safe localStorage helpers (kept for session/toast) —— */
function safeGetJSON(key) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}
function safeSetJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

/* —— Storage object — now triggers API calls ——————————— */
const Storage = {
  saveInventory : () => {},   // handled per-action via Api.*
  saveTickets   : () => {},
  saveRequests  : () => {},
  saveDocs      : () => {},
};

/* —— Auto-increment IDs (computed from live data) ————————— */
let nextInventoryId = 1;
let nextDocsId      = 1;

function recomputeIds() {
  nextInventoryId = inventory.length ? Math.max(...inventory.map(i => i.id)) + 1 : 1;
  nextDocsId      = docs.length      ? Math.max(...docs.map(d => d.id))      + 1 : 1;
}
