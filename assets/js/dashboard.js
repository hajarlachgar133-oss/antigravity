/* ============================================================
   NEXUSIT — DASHBOARD MODULE  (dashboard.js) — DB-connected
   ============================================================ */

let dashboardInitialized = false;

async function initDashboard() {
  try {
    const data = await Api.dashboard();

    const kpi   = data.kpi       || {};
    const act   = data.activity  || [];
    const chart = data.typeChart || [];

    const totalEquip  = parseInt(kpi.total_assets    || 0);
    const activeEquip = parseInt(kpi.active_assets   || 0);
    const openTickets = parseInt(kpi.open_tickets    || 0);
    const critical    = parseInt(kpi.critical_issues || 0);

    if (!dashboardInitialized) {
      animateCount($('#ds-total'),    totalEquip,  900);
      animateCount($('#ds-active'),   activeEquip, 900);
      animateCount($('#ds-tickets'),  openTickets, 900);
      animateCount($('#ds-critical'), critical,    900);
      dashboardInitialized = true;
    } else {
      $('#ds-total').text(totalEquip);
      $('#ds-active').text(activeEquip);
      $('#ds-tickets').text(openTickets);
      $('#ds-critical').text(critical);
    }

    renderActivityColumns(act);
    renderDonutChart(chart);
    initActivityTabs();

  } catch(err) {
    console.error('Dashboard load error:', err);
  }
}

/* ── Classify an activity entry into one of the 3 categories ──
   Uses the API's action_type field (most reliable), with a
   description-text fallback for unrecognised types.            ── */
function classifyActivity(a) {
  const actionType = (a.action_type || '').toLowerCase();
  const desc       = (a.description || '').toLowerCase();

  // ── Ticket / issue events ──
  const ticketActions = ['ticket_created', 'issue_created', 'request_submitted',
                         'ticket_resolved', 'ticket_updated', 'issue_resolved',
                         'issue_updated'];
  if (ticketActions.includes(actionType)) return 'ticket';

  // ── User session events ──
  const userActions = ['user_login', 'user_logout'];
  if (userActions.includes(actionType)) return 'user';

  // ── Employee events (action_type) ──
  const empActions = ['user_registered', 'user_updated', 'employee_registered',
                      'employee_updated', 'employee_entered'];
  if (empActions.includes(actionType)) return 'employee';

  // ── Description-text fallbacks ──

  // Employee section entry — "Ebano" keyword routes here
  if (desc.includes('ebano') ||
      desc.includes('employé') || desc.includes('employee') ||
      desc.includes('inscri')   || desc.includes('registered') ||
      desc.includes('nouveau compte') || desc.includes('new account')) return 'employee';

  if (desc.includes('ticket') || desc.includes('issue') ||
      desc.includes('résolu') || desc.includes('soumis') ||
      desc.includes('submitted') || desc.includes('en cours') ||
      desc.includes('request')) return 'ticket';

  if (desc.includes('connecté') || desc.includes('connect') ||
      desc.includes('logged')   || desc.includes('login') ||
      desc.includes('logout')   || desc.includes('déconnect')) return 'user';

  // Default — unrecognised events go into the Tickets column
  return 'ticket';
}

/* ── Icon + colour for each row, driven by action_type ── */
const ACTION_STYLE = {
  ticket_created    : { icon: 'fa-ticket',              cls: 'ai-blue'   },
  ticket_resolved   : { icon: 'fa-circle-check',        cls: 'ai-green'  },
  ticket_updated    : { icon: 'fa-rotate',              cls: 'ai-purple' },
  issue_created     : { icon: 'fa-triangle-exclamation',cls: 'ai-red'    },
  issue_resolved    : { icon: 'fa-circle-check',        cls: 'ai-green'  },
  issue_updated     : { icon: 'fa-rotate',              cls: 'ai-purple' },
  request_submitted : { icon: 'fa-comment-dots',        cls: 'ai-purple' },
  user_login        : { icon: 'fa-right-to-bracket',    cls: 'ai-green'  },
  user_logout       : { icon: 'fa-right-from-bracket',  cls: 'ai-red'    },
  user_registered   : { icon: 'fa-user-plus',           cls: 'ai-blue'   },
  user_updated      : { icon: 'fa-pen-to-square',       cls: 'ai-purple' },
  employee_registered: { icon: 'fa-user-plus',          cls: 'ai-blue'   },
  employee_updated  : { icon: 'fa-pen-to-square',       cls: 'ai-purple' },
  asset_added       : { icon: 'fa-server',              cls: 'ai-blue'   },
  asset_updated     : { icon: 'fa-pen',                 cls: 'ai-blue'   },
  asset_deleted     : { icon: 'fa-trash',               cls: 'ai-red'    },
};

/* ── Render a single activity row inside a column ── */
function buildActivityRow(a) {
  const style   = ACTION_STYLE[a.action_type] || { icon: a.icon || 'fa-bolt', cls: a.cls || 'ai-blue' };
  const iconCls = style.icon;
  const aiCls   = style.cls;

  // ── Status badge (tickets only) ──────────────────────────
  let badgeHtml = '';
  const cat = classifyActivity(a);
  if (cat === 'ticket') {
    const at  = (a.action_type  || '').toLowerCase();
    const dsc = (a.description  || '').toLowerCase();
    if (at === 'ticket_resolved' || at === 'issue_resolved' ||
        dsc.includes('résolu')  || dsc.includes('resolved') || dsc.includes('fermé')) {
      badgeHtml = '<span class="ds-badge ds-badge-resolved">Résolu</span>';
    } else if (at === 'issue_created' || dsc.includes('critique') || dsc.includes('critical')) {
      badgeHtml = '<span class="ds-badge ds-badge-critical">Critique</span>';
    } else if (dsc.includes('cours') || dsc.includes('progress') || at === 'ticket_updated') {
      badgeHtml = '<span class="ds-badge ds-badge-inprogress">En cours</span>';
    } else {
      badgeHtml = '<span class="ds-badge ds-badge-pending">En attente</span>';
    }
  } else if (cat === 'user') {
    const at = (a.action_type || '').toLowerCase();
    if (at === 'user_logout' || (a.description||'').toLowerCase().includes('déconnect')) {
      badgeHtml = '<span class="ds-badge ds-badge-critical">Déconnexion</span>';
    } else {
      badgeHtml = '<span class="ds-badge ds-badge-resolved">Connexion</span>';
    }
  } else if (cat === 'employee') {
    const at = (a.action_type || '').toLowerCase();
    if (at === 'user_updated' || at === 'employee_updated') {
      badgeHtml = '<span class="ds-badge ds-badge-inprogress">Mis à jour</span>';
    } else {
      badgeHtml = '<span class="ds-badge ds-badge-pending">Nouveau</span>';
    }
  }

  return `
    <div class="act-row">
      <div class="act-row-icon ${escapeHTML(aiCls)}">
        <i class="fa-solid ${escapeHTML(iconCls)}"></i>
      </div>
      <div class="act-row-body">
        <div class="act-row-desc">${escapeHTML(a.description)}${badgeHtml}</div>
        <div class="act-row-actor">${escapeHTML(a.actor_name || 'Système')}</div>
      </div>
      <div class="act-row-time">${escapeHTML(a.time || '')}</div>
    </div>`;
}

/* ── Render the 3 columns with classified activities ── */
function renderActivityColumns(activities) {
  const tickets   = activities.filter(a => classifyActivity(a) === 'ticket');
  const users     = activities.filter(a => classifyActivity(a) === 'user');
  const employees = activities.filter(a => classifyActivity(a) === 'employee');

  // Update counts
  $('#ticketColCount').text(tickets.length);
  $('#userColCount').text(users.length);
  $('#employeeColCount').text(employees.length);

  // Render each feed
  renderFeed($('#ticketFeed'),   tickets,   'ticket');
  renderFeed($('#userFeed'),     users,     'user');
  renderFeed($('#employeeFeed'), employees, 'employee');
}

function renderFeed($el, items, cat) {
  $el.empty();
  if (!items.length) {
    const labels = {
      ticket:   ['fa-ticket',   'Aucune activité ticket'],
      user:     ['fa-users',    'Aucune activité utilisateur'],
      employee: ['fa-id-card',  'Aucune activité employé'],
    };
    const [icon, msg] = labels[cat] || ['fa-bolt', 'Aucune activité'];
    $el.html(`<div class="act-empty-state"><i class="fa-solid ${icon}"></i><p>${msg}</p></div>`);
    return;
  }
  items.forEach(a => $el.append(buildActivityRow(a)));
}

/* ── Activity filter tabs (All / Tickets / Users / Employees) ── */
function initActivityTabs() {
  $('#actTabs').off('click.acttab').on('click.acttab', '.act-tab', function () {
    $('#actTabs .act-tab').removeClass('active');
    $(this).addClass('active');

    const filter = $(this).data('filter');
    const $cols  = $('#actColumnsGrid .act-column');

    if (filter === 'all') {
      $cols.show();
    } else {
      $cols.hide().filter(`[data-category="${filter}"]`).show();
    }
  });
}

/* ── Donut chart ── */
function renderDonutChart(typeCounts) {
  const $donut  = $('#donutChart');
  const $legend = $('#donutLegend');

  const palette = [
    'var(--accent3)', 'var(--accent)', 'var(--warning)', 'var(--danger)',
    'var(--accent2)', '#60a5fa', '#f472b6', '#a78bfa',
  ];

  const total = typeCounts.reduce((s, t) => s + parseInt(t.count), 0) || 1;
  let cumulative = 0;
  const stops = [];

  typeCounts.forEach(({ type, count }, i) => {
    const pct   = (parseInt(count) / total) * 100;
    const color = palette[i % palette.length];
    stops.push(`${color} ${cumulative}% ${cumulative + pct}%`);
    cumulative += pct;
  });

  if (stops.length) $donut.css('background', `conic-gradient(${stops.join(', ')})`);

  $legend.empty();
  typeCounts.forEach(({ type, count }, i) => {
    const pct   = Math.round((parseInt(count) / total) * 100);
    const color = palette[i % palette.length];
    $legend.append(`
      <div class="legend-item">
        <div class="legend-dot" style="background:${color}"></div>
        ${escapeHTML(type)} — ${pct}%
      </div>`);
  });
}

function resetDashboardCache() {
  dashboardInitialized = false;
}
