/* ============================================================
   NEXUSIT — TROUBLESHOOTING MODULE (troubleshoot.js) — DB
   ============================================================ */

let isKanbanView    = false;
let editingTicketId = null;

/* —— LOAD ————————————————————————————————————————————————— */
async function loadTroubleTickets(q = '', status = '') {
  try {
    tickets = await Api.getTickets(q, status);
    renderTroubleTable(tickets);
  } catch(err) {
    toast('Failed to load issues: ' + err.message, 'error');
  }
}

/* —— RENDER TABLE ————————————————————————————————————————— */
function renderTroubleTable(data) {
  const $tbody = $('#troubleTable').empty();

  if (!data.length) {
    $tbody.append(`
      <tr><td colspan="6">
        <div class="empty-state">
          <i class="fa fa-clipboard-check"></i>
          <p>Aucun problème trouvé. Click <strong>Add Issue</strong> to log one.</p>
        </div>
      </td></tr>`);
    renderKanban(data);
    return;
  }

  data.forEach(t => {
    const problem  = t.problem  || t.title       || '';
    const desc     = t.desc     || t.description || '';
    const response = t.response || t.response_notes || '';

    $tbody.append(`
      <tr data-id="${t.id}" style="cursor:pointer">
        <td class="cell-mono">${escapeHTML(String(t.id))}</td>
        <td style="white-space:normal;word-break:break-word;max-width:220px;line-height:1.45">
          <strong>${escapeHTML(problem)}</strong>
        </td>
        <td style="white-space:normal;word-break:break-word;max-width:280px;line-height:1.45;font-size:12.5px;color:var(--text-muted)">
          ${escapeHTML(desc) || '<em style="opacity:.4">—</em>'}
        </td>
        <td>${badgeFor(t.status)}</td>
        <td style="white-space:normal;word-break:break-word;max-width:240px;font-size:12.5px;color:var(--text-muted);line-height:1.45">
          ${escapeHTML(response) || '<em style="opacity:.4">—</em>'}
        </td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm btn-icon trouble-view-btn" title="View Details" type="button">
              <i class="fa fa-eye"></i>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon trouble-edit-btn" title="Edit" type="button">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-icon trouble-del-btn" title="Delete" type="button">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`);
  });

  renderKanban(data);
}

/* —— KANBAN ——————————————————————————————————————————————— */
function renderKanban(data) {
  const $board = $('#troubleKanbanView');
  $board.find('.kanban-cards').empty();
  const counts = { pending: 0, 'in-progress': 0, resolved: 0, critical: 0 };

  data.forEach(t => {
    const problem = t.problem || t.title       || '';
    const desc    = t.desc    || t.description || '';
    const $col = $board.find(`.kanban-col[data-status="${t.status}"]`);
    if (!$col.length) return;

    $col.find('.kanban-cards').append(`
      <div class="kanban-card" data-id="${t.id}">
        <div class="kcard-id">#${t.id}</div>
        <div class="kcard-title">${escapeHTML(problem)}</div>
        <div class="kcard-desc">${escapeHTML(desc)}</div>
        <div class="kcard-footer">
          ${badgeFor(t.status)}
          <i class="fa-solid fa-chevron-right kcard-chevron"></i>
        </div>
      </div>`);

    if (counts.hasOwnProperty(t.status)) counts[t.status]++;
  });

  Object.entries(counts).forEach(([status, count]) => {
    $board.find(`.kanban-col[data-status="${status}"] .count`).text(count);
  });
}

/* —— VIEW TOGGLE ————————————————————————————————————————— */
$('#btnToggleTroubleView').on('click', function () {
  isKanbanView = !isKanbanView;
  if (isKanbanView) {
    $('#troubleListView').hide();
    $('#troubleKanbanView').fadeIn(250).css('display', 'flex');
    $(this).html('<i class="fa-solid fa-list"></i> Table View');
  } else {
    $('#troubleKanbanView').hide();
    $('#troubleListView').fadeIn(250);
    $(this).html('<i class="fa-solid fa-table-columns"></i> Kanban View');
  }
});

/* —— SEARCH & FILTER ————————————————————————————————————— */
$('#troubleSearch').on('input', debounce(filterTickets, 300));
$('#troubleFilter').on('change', filterTickets);

function filterTickets() {
  const q = $('#troubleSearch').val().trim();
  const s = $('#troubleFilter').val();
  loadTroubleTickets(q, s);
}

/* —— ADD ISSUE BUTTON ——————————————————————————————————— */
$('#btnAddTicket').on('click', function () {
  editingTicketId = null;
  $('#issueModalTitle').text('Add Issue');
  $('#iProblem, #iDesc, #iResponse').val('');
  $('#iStatus').val('pending');
  openIssueModal();
  setTimeout(() => $('#iProblem').focus(), 150);
});

/* —— VIEW DETAILS ————————————————————————————————————————— */
$(document).on('click', '.trouble-view-btn', function (e) {
  e.stopPropagation();
  const id = parseInt($(this).closest('tr').data('id'));
  const t  = tickets.find(x => x.id === id);
  if (!t) return;
  openTicketDetailModal(t);
});

/* Also open detail when clicking a row cell (not a button) */
$(document).on('click', '#troubleTable tr td:not(:last-child)', function () {
  const id = parseInt($(this).closest('tr').data('id'));
  const t  = tickets.find(x => x.id === id);
  if (!t) return;
  openTicketDetailModal(t);
});

function openTicketDetailModal(t) {
  const problem  = t.problem  || t.title          || '—';
  const desc     = t.desc     || t.description    || '';
  const response = t.response || t.response_notes || '';

  $('#tdm-id').text('#' + t.id);
  $('#tdm-problem').text(problem);
  $('#tdm-desc').text(desc || '—');
  $('#tdm-status').html(badgeFor(t.status));
  $('#tdm-response').text(response || '—');
  $('#ticketDetailModal').addClass('open');
  $(document).on('keydown.tdm', e => { if (e.key === 'Escape') closeTicketDetailModal(); });
}

function closeTicketDetailModal() {
  $('#ticketDetailModal').removeClass('open');
  $(document).off('keydown.tdm');
}
$('#tdmClose, #tdmClose2').on('click', closeTicketDetailModal);
$('#ticketDetailModal').on('click', function (e) {
  if ($(e.target).is('#ticketDetailModal')) closeTicketDetailModal();
});

/* —— EDIT ISSUE ——————————————————————————————————————————— */
$(document).on('click', '.trouble-edit-btn', function () {
  const id = parseInt($(this).closest('tr').data('id'));
  const t  = tickets.find(x => x.id === id);
  if (!t) return;

  editingTicketId = id;
  $('#issueModalTitle').text('Modifier le Problème');
  $('#iProblem').val(t.problem  || t.title       || '');
  $('#iDesc').val(t.desc     || t.description || '');
  $('#iStatus').val(t.status);
  $('#iResponse').val(t.response || t.response_notes || '');
  openIssueModal();
});

/* —— DELETE ISSUE ————————————————————————————————————————— */
$(document).on('click', '.trouble-del-btn', async function () {
  const id = parseInt($(this).closest('tr').data('id'));
  const t  = tickets.find(x => x.id === id);
  if (!t || !confirm(`Delete issue "${t.problem || t.title}"? This cannot be undone.`)) return;

  try {
    await Api.deleteTicket(id);
    tickets = tickets.filter(x => x.id !== id);
    renderTroubleTable(tickets);
    resetDashboardCache();
    toast('Problème supprimé', 'success');
  } catch(err) {
    toast('Delete failed: ' + err.message, 'error');
  }
});

/* —— SAVE ISSUE ——————————————————————————————————————————— */
$('#issueModalSave').on('click', async function () {
  const problem  = $('#iProblem').val().trim();
  const desc     = $('#iDesc').val().trim();
  const status   = $('#iStatus').val();
  const response = $('#iResponse').val().trim();

  if (!problem) { highlightField('#iProblem'); toast('Problem title is required', 'error'); return; }

  $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');

  try {
    if (editingTicketId !== null) {
      await Api.updateTicket(editingTicketId, { problem, desc, status, response });
      const t = tickets.find(x => x.id === editingTicketId);
      if (t) Object.assign(t, { problem, desc: desc, status, response });
      toast('Problème mis à jour', 'success');
    } else {
      const res = await Api.addTicket({ problem, desc, status, response });
      tickets.unshift({ id: res.id, problem, desc, status, response });
      toast('Issue added', 'success');
    }
    closeIssueModal();
    renderTroubleTable(tickets);
    resetDashboardCache();
  } catch(err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    $(this).prop('disabled', false).html('<i class="fa fa-check"></i> Save Issue');
  }
});

/* —— MODAL HELPERS ——————————————————————————————————————— */
function openIssueModal() {
  $('#issueModal').addClass('open');
  $(document).on('keydown.issueModal', e => { if (e.key === 'Escape') closeIssueModal(); });
}
function closeIssueModal() {
  $('#issueModal').removeClass('open');
  $(document).off('keydown.issueModal');
}
$('#issueModalClose, #issueModalCancel').on('click', closeIssueModal);
$('#issueModal').on('click', function (e) { if ($(e.target).is('#issueModal')) closeIssueModal(); });
