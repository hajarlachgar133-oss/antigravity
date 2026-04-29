/* ============================================================
   NEXUSIT — IP CHECKER MODULE
   ─────────────────────────────────────────────────────────────
   Simulates network diagnostics: ping, geo, security, speed.
   
   Improvements:
   - Prevents double-click while analysis is running
   - Reset speed rings before re-analysis
   - Cleaner status icon handling
   - Better input validation
   ============================================================ */

/* Simulated geo locations for variety */
const GEO_OPTIONS = [
  'Lagos, NG', 'London, UK', 'New York, US', 'Paris, FR',
  'Amsterdam, NL', 'Frankfurt, DE', 'Dubai, AE', 'Toronto, CA',
];

/* Simulated ISP names */
const ISP_OPTIONS = [
  'MTN Nigeria', 'Airtel', 'AWS CloudFront', 'Google LLC',
  'Cloudflare Inc.', 'Digital Ocean', 'Microsoft Azure', 'Akamai',
];

let isAnalyzing = false; // Prevent double-click


/* —— EVENT LISTENERS ——————————————————————————————————————— */

$('#btnCheckIP').on('click', runIPCheck);
$('#ipInput').on('keypress', function (e) {
  if (e.which === 13) runIPCheck();
});


/**
 * Run a simulated network analysis on the entered IP/hostname.
 * Shows animated results with latency, geo, ISP, security, and speed data.
 */
function runIPCheck() {
  if (isAnalyzing) return; // Guard against double-click

  const ip = $('#ipInput').val().trim();

  if (!ip) {
    toast('Veuillez entrer une adresse IP ou un nom d\'hôte', 'error');
    $('#ipInput').focus();
    return;
  }

  // Lock UI and show spinner
  isAnalyzing = true;
  $('#ipResults, #ipSpeedPanel').hide().removeClass('show');
  $('#ipSpinner').show();
  $('#btnCheckIP').prop('disabled', true);

  // Reset speed rings to zero
  resetSpeedRings();

  // Simulate network round-trip (1.5–2.5s)
  const responseTime = 1500 + Math.random() * 1000;

  setTimeout(() => {
    $('#ipSpinner').hide();
    $('#btnCheckIP').prop('disabled', false);
    isAnalyzing = false;

    // Generate simulated results
    const isOnline = Math.random() > 0.08;  // ~92% chance online
    const latency  = isOnline ? Math.floor(Math.random() * 60 + 4) : null;
    const geo      = GEO_OPTIONS[Math.floor(Math.random() * GEO_OPTIONS.length)];
    const isp      = ISP_OPTIONS[Math.floor(Math.random() * ISP_OPTIONS.length)];
    const isSafe   = Math.random() > 0.15;

    // Populate status
    $('#ipStatus')
      .text(isOnline ? 'Online' : 'Offline')
      .css('color', isOnline ? 'var(--accent3)' : 'var(--danger)');

    $('#ipStatusIcon').html(
      isOnline
        ? '<i class="fa-solid fa-circle-check" style="color:var(--accent3)"></i>'
        : '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>'
    );

    // Populate metrics
    $('#ipLatency').text(isOnline ? `${latency} ms` : '—');
    $('#ipGeo').text(geo);
    $('#ipISP').text(isp);
    $('#ipSecurity')
      .text(isSafe ? 'Clean' : 'Flagged')
      .css('color', isSafe ? 'var(--accent3)' : 'var(--danger)');

    // Show metric cards with animation
    $('#ipResults').addClass('show');

    // Animate speed rings if online
    if (isOnline) {
      const dl = Math.floor(Math.random() * 280 + 20);  // 20–300 Mbps
      const ul = Math.floor(Math.random() * 130 + 10);  // 10–140 Mbps

      $('#ipSpeedPanel').fadeIn(400);
      animateSpeedRing('#dlRing', '#dlVal', '#dlBar', dl, 300);
      animateSpeedRing('#ulRing', '#ulVal', '#ulBar', ul, 150);

      // Speed quality labels
      $('#dlDesc').text(dl > 100 ? 'Excellent speed' : dl > 50 ? 'Good speed' : 'Moderate speed');
      $('#ulDesc').text(ul > 60  ? 'Excellent upload' : ul > 25 ? 'Good upload' : 'Moderate upload');
    }
  }, responseTime);
}


/**
 * Animate a speed ring SVG circle, progress bar, and numeric counter.
 * @param {string} ringId   — SVG circle selector
 * @param {string} valId    — Numeric label selector
 * @param {string} barId    — Progress bar fill selector
 * @param {number} value    — Actual speed value (Mbps)
 * @param {number} maxValue — Maximum axis value
 */
function animateSpeedRing(ringId, valId, barId, value, maxValue) {
  const circumference = 314; // 2π × r(50)
  const pct    = Math.min(value / maxValue, 1);
  const offset = circumference - pct * circumference;

  // Trigger CSS transition after a brief delay for visual effect
  setTimeout(() => {
    $(ringId).css('stroke-dashoffset', offset);
    $(barId).css('width', `${pct * 100}%`);
  }, 60);

  // Animate the numeric counter
  animateCount($(valId), value, 1200);
}


/** Reset all speed ring visuals to zero state. */
function resetSpeedRings() {
  $('#dlRing, #ulRing').css('stroke-dashoffset', 314);
  $('#dlBar, #ulBar').css('width', '0%');
  $('#dlVal, #ulVal').text('0');
  $('#dlDesc, #ulDesc').text('');
}
