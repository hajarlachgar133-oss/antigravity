/* ============================================================
   NEXUSIT — AUTHENTICATION  (auth.js)  — DB-connected version
   ============================================================ */

const AUTH_SESSION_KEY = 'nexus_auth_session';
let currentUser   = null;
let myUserTickets = [];

/* —— helpers ————————————————————————————————————————————— */
function getAvatarInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* —— AUTH TAB TOGGLE ————————————————————————————————————— */
$('#authTabLogin').on('click', function () {
  $(this).addClass('active'); $('#authTabRegister').removeClass('active');
  $('#formLogin').show(); $('#formRegister').hide();
  $('#loginError, #registerError').hide();
});
$('#authTabRegister').on('click', function () {
  $(this).addClass('active'); $('#authTabLogin').removeClass('active');
  $('#formRegister').show(); $('#formLogin').hide();
  $('#loginError, #registerError').hide();
});

/* —— PASSWORD VISIBILITY TOGGLE —————————————————— */
$('#togglePassBtn').on('click', function () {
  const $input = $('#authPass');
  const $icon  = $('#togglePassIcon');
  const isPass = $input.attr('type') === 'password';
  $input.attr('type', isPass ? 'text' : 'password');
  $icon.toggleClass('fa-eye', !isPass).toggleClass('fa-eye-slash', isPass);
});

/* —— LOGIN ————————————————————————————————— */
$('#btnAuthLogin').on('click', doAuth);
$('#authPass').on('keypress', e => { if (e.which === 13) doAuth(); });
$('#authEmail').on('keypress', e => { if (e.which === 13) $('#authPass').focus(); });

async function doAuth() {
  const email = $('#authEmail').val().trim().toLowerCase();
  const pass  = $('#authPass').val();
  $('#loginError').hide();

  if (!email) { $('#loginError').text('Please enter your email address.').show(); return; }
  if (!pass)  { $('#loginError').text('Please enter your password.').show(); return; }

  $('#btnAuthLogin').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Signing in…');

  try {
    const user = await Api.login(email, pass);
    currentUser = {
      id   : user.id,
      name : user.full_name,
      email: user.email,
      role : user.role,
      dept : user.department,
      avatar: user.avatar_initials,
    };
    safeSetJSON(AUTH_SESSION_KEY, currentUser);
    launchApp();
  } catch(err) {
    const msg = "Login Error: " + (err.message || 'Incorrect email or password.');
    console.error("doAuth Error:", err);
    $('#loginError').text(msg).show();
    $('#authPass').val('').focus();
  } finally {
    $('#btnAuthLogin').prop('disabled', false).html('<i class="fa fa-right-to-bracket"></i> Sign In');
  }
}

/* —— REGISTER ———————————————————————————————————————————— */
$('#btnAuthRegister').on('click', doRegister);
$('#regPasswd').on('keypress', e => { if (e.which === 13) doRegister(); });

async function doRegister() {
  const name  = $('#regFullName').val().trim();
  const email = $('#regEmailAddr').val().trim().toLowerCase();
  const dept  = $('#regDeptSel').val();
  const pass  = $('#regPasswd').val();

  $('#registerError').hide();

  if (!name || !email || !dept || pass.length < 6) {
    $('#registerError').text('Fill all fields. Password must be 6+ characters.').show();
    return;
  }

  if (!/.+@.+\..+/.test(email)) {
    $('#registerError').text('Please enter a valid email address.').show();
    return;
  }

  $('#btnAuthRegister').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Creating…');

  try {
    await Api.register({ full_name: name, email, password: pass, department: dept });
    toast('Compte créé ! Vous pouvez maintenant vous connecter. ✅', 'success');
    $('#authTabLogin').click();
    $('#authEmail').val(email);
    $('#authPass').val('').focus();
  } catch(err) {
    $('#registerError').text(err.message || 'Registration failed.').show();
  } finally {
    $('#btnAuthRegister').prop('disabled', false).html('<i class="fa fa-user-plus"></i> Create Employee Account');
  }
}

/* —— LAUNCH APP ——————————————————————————————————————————— */
function launchApp() {
  safeSetJSON(AUTH_SESSION_KEY, currentUser);
  populateSidebarUserCard();

  if (currentUser.role === 'admin') {
    $('#adminNavGroup').show();
    $('#userNavGroup').hide();
    $('#topbarSettingsBtn').show();
    $('.status-dot').show();

    $('#loginScreen').fadeOut(280, () => {
      $('#appShell').css('display', 'flex');
      initAdminApp();
    });
  } else {
    preFillUserForms();
    refreshProfileUI();
    $('#userHeroName').text(currentUser.name.split(' ')[0]);
    $('#adminNavGroup').hide();
    $('#userNavGroup').show();
    $('#topbarSettingsBtn').hide();
    $('.status-dot').hide();

    $('#loginScreen').fadeOut(280, async () => {
      $('#appShell').css('display', 'flex');
      await loadMyUserTickets();
      initChat();
      switchSection('user-home');
    });
  }
}

function populateSidebarUserCard() {
  const ini  = currentUser.avatar || getAvatarInitials(currentUser.name);
  const role = currentUser.role === 'admin' ? 'Responsable IT · Administrateur' : currentUser.dept;
  const bCls = currentUser.role === 'admin' ? 'badge badge-blue' : 'badge badge-green';
  const bTxt = currentUser.role === 'admin' ? 'Administrateur' : 'Employé';
  $('.user-avatar').text(ini);
  $('.user-info .name').text(currentUser.name);
  $('.user-info .role').text(role);
  $('#sidebarRoleBadge').attr('class', bCls).text(bTxt).show();
  $('#logoutBtn').show();
}

function preFillUserForms() {
  $('#utkName').val(currentUser.name);
  $('#utkEmail').val(currentUser.email);
  $('#utkDept').val(currentUser.dept);
}

/* —— LOGOUT ——————————————————————————————————————————————— */
async function doLogout() {
  try { await Api.logout(); } catch(e) {}
  localStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  myUserTickets = [];
  $('#appShell').removeAttr('style');
  $('#chatMessages').empty();
  $('#userDevResult').empty();
  $('#adminNavGroup, #userNavGroup').hide();
  $('#sidebarRoleBadge').hide();
  $('#logoutBtn').hide();
  $('#topbarSettingsBtn').show();
  $('.status-dot').show();
  $('#loginScreen').stop(true, true).fadeIn(300);
  $('#authEmail, #authPass').val('');
  $('#loginError, #registerError').hide();
  $('#authTabLogin').click();
}

$('#logoutBtn').on('click', function () {
  const confirmed = window.confirm('Se déconnecter de NexusIT ?\n\nVous serez redirigé vers l\'écran de connexion.');
  if (!confirmed) return;
  doLogout();
});

/* —— SESSION RESTORE ————————————————————————————————————— */
$(document).ready(async function () {
  try {
    const user = await Api.me();
    currentUser = {
      id   : user.id,
      name : user.full_name,
      email: user.email,
      role : user.role,
      dept : user.department,
      avatar: user.avatar_initials,
    };
    launchApp();
  } catch(e) {
    $('#loginScreen').show();
    $('#appShell').hide();
    $('#logoutBtn').hide();
  }
});

/* ═══════════════════════════════════════════════════════════
   EMPLOYEE SECTIONS
   ═══════════════════════════════════════════════════════════ */

/* —— DEVICE SEARCH ——————————————————————————————————————— */
$('#btnUserDevSearch').on('click', doUserDeviceSearch);
$('#userDevInput').on('keypress', e => { if (e.which === 13) doUserDeviceSearch(); });

const DEV_ICONS = {
  Laptop:'fa-laptop', Desktop:'fa-desktop', Server:'fa-server',
  Printer:'fa-print', Switch:'fa-network-wired', Router:'fa-wifi',
  Monitor:'fa-display', UPS:'fa-plug-circle-bolt',
};

async function doUserDeviceSearch() {
  const q = $('#userDevInput').val().trim();
  if (!q) { toast('Entrez un nom d\'appareil, un no de série ou un emplacement pour rechercher', 'error'); return; }

  $('#userDevSpinner').show();
  $('#userDevResult').empty();

  try {
    const hits = await Api.getInventory(q);
    $('#userDevSpinner').hide();

    if (!hits.length) {
      $('#userDevResult').html(`
        <div class="auth-empty-state">
          <i class="fa-solid fa-magnifying-glass"></i>
          <div class="aes-title">Aucun appareil trouvé</div>
          <div class="aes-sub">Essayez un autre nom, numéro de série, type ou emplacement</div>
        </div>`);
      return;
    }

    let html = '';
    hits.forEach(d => {
      const icon = DEV_ICONS[d.asset_type] || 'fa-microchip';
      const status = d.status;
      let cls = 'dev-online', si = 'fa-circle-check', sl = 'Actif';
      if (status === 'maintenance') { cls = 'dev-maintenance'; si = 'fa-wrench';       sl = 'Maintenance'; }
      if (status === 'inactive')    { cls = 'dev-offline';     si = 'fa-circle-xmark'; sl = 'Inactif';    }
      if (status === 'retired')     { cls = 'dev-offline';     si = 'fa-circle-xmark'; sl = 'Retiré';     }

      html += `
        <div class="dev-card">
          <div class="dev-card-icon"><i class="fa-solid ${icon}"></i></div>
          <div class="dev-card-body">
            <div class="dev-card-name">${escapeHTML(d.asset_name)}</div>
            <div class="dev-card-meta">Serial: ${escapeHTML(d.serial_number)} &nbsp;·&nbsp; ${escapeHTML(d.location)}</div>
            <div class="dev-card-tags">
              <span class="dev-tag dev-tag-blue">${escapeHTML(d.asset_type)}</span>
              ${status==='active'      ? '<span class="dev-tag dev-tag-green">✓ En Service</span>'        : ''}
              ${status==='maintenance' ? '<span class="dev-tag dev-tag-orange">⚠ En Maintenance</span>': ''}
              ${status==='inactive'    ? '<span class="dev-tag dev-tag-red">Inactif</span>'               : ''}
              ${status==='retired'     ? '<span class="dev-tag dev-tag-red">Retiré</span>'                : ''}
            </div>
          </div>
          <div class="dev-status-ring ${cls}">
            <i class="fa-solid ${si}"></i>
            <span>${sl}</span>
          </div>
        </div>`;
    });
    $('#userDevResult').html(html);
  } catch(err) {
    $('#userDevSpinner').hide();
    toast('Search failed: ' + err.message, 'error');
  }
}

/* —— PRIORITY TOGGLE ————————————————————————————————————— */
$('#utkPriorityRow').on('click', '.pri-btn', function () {
  const p = $(this).data('p');
  $('#utkPriorityRow .pri-btn').removeClass('pri-low pri-medium pri-high');
  if (p === 'Low')    $(this).addClass('pri-low');
  if (p === 'Medium') $(this).addClass('pri-medium');
  if (p === 'High')   $(this).addClass('pri-high');
  $('#utkPriority').val(p);
});

/* —— SUBMIT EMPLOYEE TICKET —————————————————————————————— */
$('#btnSubmitUserTicket').on('click', submitUserTicket);

async function submitUserTicket() {
  const dept     = $('#utkDept').val();
  const type     = $('#utkType').val();
  const subject  = $('#utkSubject').val().trim();
  const details  = $('#utkDetails').val().trim();
  const priority = $('#utkPriority').val() || 'Low';
  const device   = $('#utkDevice').val().trim();

  if (!dept || !type || !subject) {
    toast('Veuillez remplir tous les champs obligatoires (*)', 'error');
    return;
  }

  $('#btnSubmitUserTicket').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Submitting…');

  try {
    const res = await Api.submitUserTicket({ subject, type, dept, details, priority, device });
    toast(`Ticket ${res.ticket_ref} soumis ✅ — L\'équipe informatique vous répondra sous 24 heures.`, 'success');
    resetUserTicketForm();
    await loadMyUserTickets();
    setTimeout(() => switchSection('mytickets'), 1200);
  } catch(err) {
    toast('Submission failed: ' + err.message, 'error');
  } finally {
    $('#btnSubmitUserTicket').prop('disabled', false).html('<i class="fa fa-paper-plane"></i> Submit Ticket');
  }
}

$('#btnClearUserTicket').on('click', resetUserTicketForm);
function resetUserTicketForm() {
  $('#utkSubject, #utkDetails, #utkDevice').val('');
  $('#utkDept, #utkType').val('');
  $('#utkPriorityRow .pri-btn').removeClass('pri-low pri-medium pri-high');
  $('#utkPriorityRow .pri-btn[data-p="Low"]').addClass('pri-low');
  $('#utkPriority').val('Low');
}

/* —— LOAD & RENDER EMPLOYEE TICKETS ————————————————————— */
async function loadMyUserTickets() {
  try {
    myUserTickets = await Api.getUserTickets();
    renderUserTickets();
    updateUserTicketBadge();
  } catch(e) { console.warn('Could not load user tickets:', e); }
}

function renderUserTickets() {
  const $tbody = $('#userTicketsTbody').empty();
  const pClass = { Low: 'badge-green', Medium: 'badge-yellow', High: 'badge-red' };
  const sClass = { Open: 'badge-blue', 'In Progress': 'badge-blue', Resolved: 'badge-green', Closed: '' };

  $('#userTicketCount').text(`${myUserTickets.length} ticket${myUserTickets.length !== 1 ? 's' : ''}`);

  if (!myUserTickets.length) {
    $tbody.html(`<tr><td colspan="7">
      <div class="auth-empty-state">
        <i class="fa-solid fa-ticket"></i>
        <div class="aes-title">Aucun ticket soumis pour le moment</div>
        <div class="aes-sub">Soumettez une demande — notre équipe informatique répondra dans les 24 heures.</div>
      </div>
    </td></tr>`);
    return;
  }

  myUserTickets.forEach(t => {
    $tbody.append(`
      <tr>
        <td class="cell-mono">${escapeHTML(t.ticket_ref || t.id)}</td>
        <td style="font-weight:600;max-width:260px;white-space:normal;word-break:break-word;line-height:1.45" title="${escapeHTML(t.subject)}">${escapeHTML(t.subject)}</td>
        <td>${escapeHTML(t.type)}</td>
        <td><span class="badge ${pClass[t.priority] || 'badge-blue'}">${escapeHTML(t.priority)}</span></td>
        <td class="cell-muted">${escapeHTML(t.dept)}</td>
        <td><span class="badge ${sClass[t.status] || 'badge-blue'}">${escapeHTML(t.status)}</span></td>
        <td class="cell-muted">${escapeHTML(t.submitted)}</td>
      </tr>`);
  });
}

function updateUserTicketBadge() {
  const open = myUserTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  open > 0 ? $('#userTicketNavBadge').text(open).show() : $('#userTicketNavBadge').hide();
}

$('#btnRefreshUserTickets').on('click', async function () {
  await loadMyUserTickets();
  toast('Statut synchronisé depuis le département informatique ✅', 'success');
});

/* —— PROFILE SECTION ————————————————————————————————————— */
function refreshProfileUI() {
  if (!currentUser) return;
  const ini = currentUser.avatar || getAvatarInitials(currentUser.name);
  $('#profileBigAvatar').text(ini);
  $('#profileHeroName').text(currentUser.name);
  $('#profileHeroEmail').text(currentUser.email);
  $('#profileHeroDept').text(currentUser.dept);
  $('#profEditName').val(currentUser.name);
  $('#profEditDept').val(currentUser.dept);
}

$('#btnSaveProfile').on('click', async function () {
  if (!currentUser || currentUser.role !== 'employee') return;
  const name    = $('#profEditName').val().trim();
  const dept    = $('#profEditDept').val();
  const newPass = $('#profEditPass').val();
  const confPass= $('#profEditPassConfirm').val();

  if (!name) { toast('Name cannot be empty', 'error'); return; }
  if (newPass && newPass !== confPass) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
  if (newPass && newPass.length < 6)   { toast('Le mot de passe doit comporter au moins 6 caractères', 'error'); return; }

  try {
    await Api.updateProfile({ full_name: name, department: dept, new_password: newPass });
    currentUser.name = name;
    currentUser.dept = dept;
    currentUser.avatar = getAvatarInitials(name);
    safeSetJSON(AUTH_SESSION_KEY, currentUser);
    populateSidebarUserCard();
    refreshProfileUI();
    preFillUserForms();
    toast('Profil mis à jour avec succès ✅', 'success');
    $('#profEditPass, #profEditPassConfirm').val('');
  } catch(err) {
    toast('Update failed: ' + err.message, 'error');
  }
});

/* —— Section title map extension ————————————————————————— */
$(function () {
  Object.assign(SECTION_TITLES, {
    'user-home'    : 'Portail Employé',
    'mydevice'     : 'Mon Ordinateur',
    'user-ticket'  : 'Soumettre un Ticket',
    'mytickets'    : 'Mes Tickets',
    'user-profile' : 'Mon Profil',
  });
});
