/* ============================================================
   NEXUSIT — TIME-BASED THEME MODULE  (theme.js)
   Night  mode : 18:00 – 06:00  (deep dark)
   Morning mode: 06:00 – 18:00  (bright light)
   ============================================================ */

(function () {
  const KEY = 'nexusit_theme';
  const ROOT = document.documentElement;

  /* ── Auto-detect based on current hour ── */
  function autoMode() {
    const h = new Date().getHours();
    return (h >= 6 && h < 18) ? 'morning' : 'night';
  }

  /* ── Apply a mode ── */
  function applyMode(mode) {
    ROOT.classList.remove('mode-morning', 'mode-night');
    ROOT.classList.add('mode-' + mode);

    /* Meta updates */
    const metaColor  = document.querySelector('meta[name="theme-color"]');
    const metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaColor)  metaColor.content  = (mode === 'morning') ? '#f0f6ff' : '#0b0f19';
    if (metaScheme) metaScheme.content = (mode === 'morning') ? 'light'   : 'dark';

    /* Toggle button icon */
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = (mode === 'morning')
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
      btn.title = (mode === 'morning')
        ? 'Passer en Mode Nuit'
        : 'Passer en Mode Matin';
      btn.setAttribute('aria-label', btn.title);
    }

    /* Mode label */
    const lbl = document.getElementById('themeModeLabel');
    if (lbl) {
      lbl.textContent = (mode === 'morning') ? 'Mode Matin' : 'Mode Nuit';
    }

    localStorage.setItem(KEY, mode);
  }

  /* ── Toggle ── */
  function toggleMode() {
    const current = ROOT.classList.contains('mode-morning') ? 'morning' : 'night';
    applyMode(current === 'morning' ? 'night' : 'morning');
  }

  /* ── Init: default to white/morning theme ── */
  applyMode(localStorage.getItem(KEY) || 'morning');

  /* ── Wire button after DOM ready ── */
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.addEventListener('click', toggleMode);

    /* Re-apply so button icon is correct */
    const current = ROOT.classList.contains('mode-morning') ? 'morning' : 'night';
    applyMode(current);

    /* Auto-switch every minute (catches 06:00 / 18:00 boundary) */
    setInterval(function () {
      if (!localStorage.getItem(KEY + '_manual')) {
        applyMode(autoMode());
      }
    }, 60000);
  });

  /* Expose globals */
  window.applyThemeMode  = applyMode;
  window.toggleThemeMode = toggleMode;
  window.getAutoMode     = autoMode;
})();
