/* ============================================================
   NEXUSIT — NAVIGATION MODULE
   ─────────────────────────────────────────────────────────────
   Handles sidebar navigation, section switching, mobile menu,
   and keyboard accessibility.
   
   Improvements:
   - Keyboard accessible (Enter/Space to switch sections)
   - ARIA attribute management for hamburger
   - Scroll-to-top on section switch
   - Escape key closes mobile sidebar
   ============================================================ */

/* Section labels shown in the topbar */
const SECTION_TITLES = {
  dashboard   : 'Tableau de Bord Général',
  inventory   : 'Gestion des Stocks / Inventaire',
  chatbot     : 'Chat d\'Assistance',
  troubleshoot: 'Centre de Dépannage',
  ipchecker   : 'Analyseur IP Réseau',
  requests    : 'Demandes & Réclamations',
  settings    : 'Paramètres du Système',
  docs        : 'Documentation',
};


/**
 * Switch the visible section and update sidebar active state.
 * @param {string} target — Section key (matches data-section attr)
 */
function switchSection(target) {
  const $section = $(`#sec-${target}`);
  if (!$section.length) return;

  // Update sidebar active state
  $('.nav-item').removeClass('active');
  $(`.nav-item[data-section="${target}"]`).addClass('active');

  // Toggle section visibility
  $('.section').removeClass('active');
  $section.addClass('active');

  // Update topbar heading
  $('#topbarTitle').text(SECTION_TITLES[target] || target);

  // Scroll page content to top on section switch
  $('.page-content').scrollTop(0);

  // Lazy-refresh data when section becomes visible
  if (typeof currentUser !== 'undefined' && currentUser) {
    if (target === 'dashboard')    initDashboard();
    if (target === 'inventory')    loadInventory();
    if (target === 'troubleshoot') loadTroubleTickets();
    if (target === 'requests')     loadRequests();
    if (target === 'docs')         loadDocs();
  }

  // Close mobile sidebar after navigation
  closeMobileSidebar();
}


/** Close the mobile sidebar and overlay. */
function closeMobileSidebar() {
  $('#sidebar').removeClass('open');
  $('#sidebarOverlay').removeClass('open');
  $('#hamburger').attr('aria-expanded', 'false');
}


/* —— EVENT LISTENERS ——————————————————————————————————————— */

$(function () {
  // Sidebar nav clicks
  $(document).on('click', '.nav-item', function () {
    switchSection($(this).data('section'));
  });

  // Keyboard support for nav items (Enter / Space)
  $(document).on('keydown', '.nav-item', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchSection($(this).data('section'));
    }
  });

  // Mobile hamburger toggle
  $('#hamburger').on('click', function () {
    const isOpen = $('#sidebar').hasClass('open');
    if (isOpen) {
      closeMobileSidebar();
    } else {
      $('#sidebar').addClass('open');
      $('#sidebarOverlay').addClass('open');
      $(this).attr('aria-expanded', 'true');
    }
  });

  // Overlay click closes sidebar
  $('#sidebarOverlay').on('click', closeMobileSidebar);

  // Escape key closes sidebar on mobile
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && $('#sidebar').hasClass('open')) {
      closeMobileSidebar();
    }
  });
});
