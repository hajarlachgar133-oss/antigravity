/* ============================================================
   NEXUSIT — REQUESTS & COMPLAINTS  (requests.js) — DB-connected
   ─────────────────────────────────────────────────────────────
   Status values sent to API must be English labels that the
   backend's alias map can normalise to DB values:
     "Pending"  → pending   (DB)
     "In Review"→ in_review (DB)
     "Resolved" → resolved  (DB)
     "Rejected" → rejected  (DB)
   ============================================================ */

/* —— PRIORITY BADGE CLASS ————————————————————————————————— */
function reqPriorityBadge(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'critical') return 'badge-red';
  if (p === 'medium')                   return 'badge-yellow';
  return 'badge-green';  // low / normal
}

/* —— STATUS BADGE CLASS ——————————————————————————————————— */
function reqStatusBadge(status) {
  const s = (status || '').toLowerCase().replace(' ', '_');
  const map = {
    pending    : 'badge-yellow',
    in_review  : 'badge-blue',
    in_progress: 'badge-blue',
    resolved   : 'badge-green',
    rejected   : 'badge-red',
    closed     : 'badge-red',
    cancelled  : 'badge-red',
  };
  return map[s] || 'badge-yellow';
}

/* —— LOAD & RENDER ——————————————————————————————————————— */
async function loadRequests() {
  try {
    serviceReqs = await Api.getRequests();
    renderRequests();
  } catch (err) {
    toast('Failed to load requests: ' + err.message, 'error');
  }
}

function renderRequests() {
  const $tbody = $('#requestsTable').empty();
  const count  = serviceReqs.length;
  $('#reqCount').text(`${count} request${count !== 1 ? 's' : ''}`);

  if (!count) {
    $tbody.append(`
      <tr><td colspan="7">
        <div class="empty-state">
          <i class="fa fa-inbox"></i>
          <p>No requests submitted yet</p>
        </div>
      </td></tr>`);
    return;
  }

  serviceReqs.forEach((r, i) => {
    const priority = r.priority || 'Normal';
    const status   = r.status   || 'Pending';
    const pClass   = reqPriorityBadge(priority);
    const sClass   = reqStatusBadge(status);

    /* Status dropdown — values are what the backend's alias map accepts */
    const statusSelect = `
      <select class="input req-status-sel" data-id="${r.id}" data-index="${i}"
        style="padding:4px 10px;font-size:11px;width:auto;min-width:130px;height:30px"
        aria-label="Status for request ${i + 1}">
        <option value="Pending"   ${status === 'Pending'     ? 'selected' : ''}>Pending</option>
        <option value="In Review" ${status === 'In Review'   ? 'selected' : ''}>In Review</option>
        <option value="Resolved"  ${status === 'Resolved'    ? 'selected' : ''}>Resolved</option>
        <option value="Rejected"  ${status === 'Rejected'    ? 'selected' : ''}>Rejected</option>
      </select>`;

    $tbody.append(`
      <tr>
        <td class="cell-mono">${String(i + 1).padStart(2, '0')}</td>
        <td>
          <strong>${escapeHTML(r.name)}</strong>
          <br><small class="cell-muted">${escapeHTML(r.email)}</small>
        </td>
        <td><span class="badge badge-blue">${escapeHTML(r.type || '')}</span></td>
        <td class="truncate-cell">${escapeHTML(r.subject)}</td>
        <td style="font-size:12px;color:var(--text-muted)">${escapeHTML(r.dept || '—')}</td>
        <td><span class="badge ${pClass}">${escapeHTML(priority)}</span></td>
        <td>${statusSelect}</td>
      </tr>`);
  });

  /* Live status update — delegated so it survives re-renders */
  $('#requestsTable').off('change', '.req-status-sel').on('change', '.req-status-sel', async function () {
    const id     = parseInt($(this).data('id'));
    const idx    = parseInt($(this).data('index'));
    const newSts = $(this).val(); // e.g. "In Review"

    try {
      await Api.updateRequest(id, { status: newSts });
      if (serviceReqs[idx]) serviceReqs[idx].status = newSts;
      toast(`Request #${String(idx + 1).padStart(2, '0')} → ${newSts}`, 'success');
    } catch (err) {
      toast('Update failed: ' + err.message, 'error');
      // Revert dropdown to saved value
      $(this).val(serviceReqs[idx]?.status || 'Pending');
    }
  });
}

/* —— ADMIN FORM SUBMISSION ——————————————————————————————— */
$('#btnSubmitRequest').on('click', async function () {
  const name    = $('#reqName').val().trim();
  const email   = $('#reqEmail').val().trim();
  const type    = $('#reqType').val();
  const dept    = $('#reqDept').val();
  const subject = $('#reqSubject').val().trim();
  const details = $('#reqDetails').val().trim();

  let hasError = false;
  if (!name)    { highlightField('#reqName');    hasError = true; }
  if (!email)   { highlightField('#reqEmail');   hasError = true; }
  if (!type)    { highlightField('#reqType');    hasError = true; }
  if (!dept)    { highlightField('#reqDept');    hasError = true; }
  if (!subject) { highlightField('#reqSubject'); hasError = true; }
  if (hasError) { toast('Please fill in all required fields', 'error'); return; }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    highlightField('#reqEmail');
    toast('Please enter a valid email address', 'error');
    return;
  }

  $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Submitting…');

  try {
    await Api.addRequest({ name, email, type, dept, subject, details, priority: 'medium' });
    await loadRequests();
    clearRequestForm();
    toast('Request submitted successfully!', 'success');
  } catch (err) {
    toast('Submit failed: ' + err.message, 'error');
  } finally {
    $(this).prop('disabled', false).html('<i class="fa fa-paper-plane"></i> Submit Request');
  }
});

/* —— REFRESH BUTTON (injected once on DOM ready) ————————— */
$(document).ready(function () {
  const $header = $('#sec-requests .panel-header').first();
  if ($header.length && !$('#btnRefreshRequests').length) {
    $header.append(`
      <button class="btn btn-ghost btn-sm" id="btnRefreshRequests" type="button"
        title="Reload requests" style="margin-left:auto">
        <i class="fa-solid fa-rotate-right"></i> Refresh
      </button>`);
  }
});

$('#sec-requests').on('click', '#btnRefreshRequests', async function () {
  await loadRequests();
  toast('Requests refreshed ✅', 'success');
});

/* —— HELPERS ———————————————————————————————————————————— */
function clearRequestForm() {
  $('#reqName, #reqEmail, #reqSubject, #reqDetails').val('');
  $('#reqType, #reqDept').val('');
}
