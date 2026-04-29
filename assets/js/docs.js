/* ============================================================
   NEXUSIT — DOCUMENTATION MODULE  (docs.js) — DB-connected
   ============================================================ */

let editingDocId = null;
let activeDocCat = '';

/* —— LOAD & RENDER ——————————————————————————————————————— */
async function loadDocs() {
  const q   = ($('#docsSearch').val() || '').trim();
  const cat = activeDocCat;
  try {
    docs = await Api.getDocs(q, cat);
    renderDocs();
  } catch(err) {
    toast('Failed to load articles: ' + err.message, 'error');
  }
}

function renderDocs() {
  const $list = $('#docsList').empty();

  if (!docs.length) {
    $list.html(`
      <div class="empty-state">
        <i class="fa fa-file-circle-question"></i>
        <p>Aucun article trouvé</p>
      </div>`);
    return;
  }

  docs.forEach(d => {
    const icon = 'fa-file-lines'; // DB doesn't store icon; use default
    $list.append(`
      <div class="docs-article" data-id="${d.id}">
        <div class="docs-article-header">
          <div class="docs-article-icon"><i class="fa-solid ${escapeHTML(icon)}"></i></div>
          <div class="docs-article-meta">
            <div class="docs-article-title">${escapeHTML(d.title)}</div>
            <div class="docs-article-sub">
              <span class="docs-cat-pill">${escapeHTML(d.category)}</span>
              <span>${(d.content || '').length} chars</span>
              ${d.author_name ? `<span>by ${escapeHTML(d.author_name)}</span>` : ''}
            </div>
          </div>
          <div class="docs-article-actions">
            <button class="btn btn-ghost btn-sm btn-icon doc-edit-btn" title="Edit" type="button">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-icon doc-del-btn" title="Delete" type="button">
              <i class="fa fa-trash"></i>
            </button>
          </div>
          <i class="fa-solid fa-chevron-right docs-chevron"></i>
        </div>
        <div class="docs-article-body">${escapeHTML(d.content || '')}</div>
      </div>`);
  });
}

/* —— EXPAND / COLLAPSE ——————————————————————————————————— */
$(document).on('click', '.docs-article-header', function (e) {
  if ($(e.target).closest('.docs-article-actions').length) return;
  $(this).closest('.docs-article').toggleClass('open');
});

/* —— CATEGORY TABS ——————————————————————————————————————— */
$('#docsTabs').on('click', '.docs-tab', function () {
  $('#docsTabs .docs-tab').removeClass('active');
  $(this).addClass('active');
  activeDocCat = $(this).data('cat');
  loadDocs();
});

/* —— SEARCH ——————————————————————————————————————————————— */
$('#docsSearch').on('input', debounce(loadDocs, 300));

/* —— MODAL: NEW ——————————————————————————————————————————— */
$('#btnAddDoc').on('click', function () {
  editingDocId = null;
  $('#docModalTitle').text('New Article');
  $('#dTitle, #dIcon, #dContent').val('');
  $('#dCategory').val('');
  openDocModal();
  setTimeout(() => $('#dTitle').focus(), 150);
});

/* —— MODAL: EDIT ————————————————————————————————————————— */
$(document).on('click', '.doc-edit-btn', function (e) {
  e.stopPropagation();
  const id = parseInt($(this).closest('.docs-article').data('id'));
  const d  = docs.find(x => x.id === id);
  if (!d) return;
  editingDocId = id;
  $('#docModalTitle').text('Modifier l\'Article');
  $('#dTitle').val(d.title);
  $('#dCategory').val(d.category);
  $('#dIcon').val('');
  $('#dContent').val(d.content);
  openDocModal();
});

/* —— DELETE ——————————————————————————————————————————————— */
$(document).on('click', '.doc-del-btn', async function (e) {
  e.stopPropagation();
  const id = parseInt($(this).closest('.docs-article').data('id'));
  const d  = docs.find(x => x.id === id);
  if (!d || !confirm(`Delete "${d.title}"? This cannot be undone.`)) return;

  try {
    await Api.deleteDoc(id);
    docs = docs.filter(x => x.id !== id);
    renderDocs();
    toast('Article supprimé', 'success');
  } catch(err) {
    toast('Delete failed: ' + err.message, 'error');
  }
});

/* —— SAVE ———————————————————————————————————————————————— */
$('#docModalSave').on('click', async function () {
  const title    = $('#dTitle').val().trim();
  const category = $('#dCategory').val();
  const content  = $('#dContent').val().trim();

  let hasError = false;
  if (!title)    { highlightField('#dTitle');    hasError = true; }
  if (!category) { highlightField('#dCategory'); hasError = true; }
  if (!content)  { highlightField('#dContent');  hasError = true; }
  if (hasError) { toast('Please fill in all required fields', 'error'); return; }

  $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');

  try {
    if (editingDocId !== null) {
      await Api.updateDoc(editingDocId, { title, category, content });
      const d = docs.find(x => x.id === editingDocId);
      if (d) Object.assign(d, { title, category, content });
      toast('Article mis à jour', 'success');
    } else {
      const res = await Api.addDoc({ title, category, content });
      docs.unshift({ id: res.id, title, category, content, author_name: currentUser?.name || '' });
      toast('Article créé', 'success');
    }
    closeDocModal();
    renderDocs();
  } catch(err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    $(this).prop('disabled', false).html('<i class="fa fa-check"></i> Save Article');
  }
});

/* —— MODAL HELPERS ——————————————————————————————————————— */
function openDocModal() {
  $('#docModal').addClass('open');
  $(document).on('keydown.docModal', e => { if (e.key === 'Escape') closeDocModal(); });
}
function closeDocModal() {
  $('#docModal').removeClass('open');
  $(document).off('keydown.docModal');
}
$('#docModalClose, #docModalCancel').on('click', closeDocModal);
$('#docModal').on('click', function (e) { if ($(e.target).is('#docModal')) closeDocModal(); });
