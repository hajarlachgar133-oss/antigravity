/* ============================================================
   NEXUSIT — SETTINGS MODULE + APP BOOTSTRAP  (settings.js)
   DB-connected version
   ============================================================ */

/* —— LOAD SETTINGS ——————————————————————————————————————— */
async function loadSettings() {
  try {
    const s = await Api.getSettings();
    $('#setUserName').val(s.full_name || '');
    $('#setAdminEmail').val(s.email   || '');
  } catch(err) {
    console.warn('Could not load settings:', err);
  }
}

/* —— SETTINGS NAV BUTTON ————————————————————————————————— */
$('#topbarSettingsBtn').on('click', () => switchSection('settings'));

/* —— SAVE SETTINGS ——————————————————————————————————————— */
$('#btnSaveSettings').on('click', async function () {
  const name  = $('#setUserName').val().trim();
  const email = $('#setAdminEmail').val().trim().toLowerCase();
  const pass  = $('#setAdminPass').val();
  const confP = $('#setAdminPassConfirm').val();

  if (!name) { highlightField('#setUserName'); toast('Veuillez entrer un nom d\'affichage valide', 'error'); return; }

  if (pass) {
    if (pass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (pass !== confP)  { toast('Passwords do not match', 'error'); return; }
  }

  $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving…');

  try {
    await Api.saveSettings({
      full_name        : name,
      email            : email,
      new_password     : pass  || undefined,
      confirm_password : confP || undefined,
    });

    // Update sidebar display
    if (currentUser) {
      currentUser.name  = name;
      currentUser.email = email || currentUser.email;
      populateSidebarUserCard();
    }

    $('#setAdminPass, #setAdminPassConfirm').val('');
    toast('Paramètres enregistrés avec succès ✅', 'success');
  } catch(err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    $(this).prop('disabled', false).html('<i class="fa fa-save"></i> Save Changes');
  }
});


/* ============================================================
   APPLICATION BOOTSTRAP  — called by auth.js after admin login
   ============================================================ */
async function initAdminApp() {
  await loadSettings();

  // Load all data from DB in parallel
  const [inv, tkt, req, dc] = await Promise.allSettled([
    Api.getInventory(),
    Api.getTickets(),
    Api.getRequests(),
    Api.getDocs(),
  ]);

  inventory   = inv.status === 'fulfilled' ? inv.value   : [];
  tickets     = tkt.status === 'fulfilled' ? tkt.value   : [];
  serviceReqs = req.status === 'fulfilled' ? req.value   : [];
  docs        = dc.status  === 'fulfilled' ? dc.value    : [];

  // Render all sections
  renderInventory(inventory);
  renderTroubleTable(tickets);
  renderRequests();
  renderDocs();

  // Bootstrap interactive sections
  initDashboard();
  initChat();

  switchSection('dashboard');

  console.log(
    '%c NexusIT %c Admin loaded — DB connected ✅',
    'background:linear-gradient(135deg,#00c8ff,#3b72e0);color:#fff;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:bold;',
    'background:#0c1626;color:#5a7a8a;padding:4px 8px;border-radius:0 4px 4px 0;'
  );
}
