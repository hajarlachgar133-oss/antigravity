/* ============================================================
   NEXUSIT — INVENTORY MODULE  (inventory.js) — DB-connected
   ============================================================ */

let editingInventoryId = null;

/* —— LOAD ————————————————————————————————————————————————— */
async function loadInventory(q = '') {
  try {
    inventory = await Api.getInventory(q);
    renderInventory(inventory);
  } catch(err) {
    toast('Failed to load inventory: ' + err.message, 'error');
  }
}

/* —— RENDER —————————————————————————————————————————————— */
function renderInventory(data) {
  const $tbody = $('#inventoryTable').empty();

  if (!data.length) {
    $tbody.append(`
      <tr><td colspan="7">
        <div class="empty-state">
          <i class="fa fa-box-open"></i>
          <p>Aucun équipement trouvé</p>
        </div>
      </td></tr>`);
    updateInventoryBadge();
    return;
  }

  data.forEach((item, idx) => {
    // Normalise field names from DB (asset_name, asset_type, serial_number)
    const name   = item.asset_name    || item.name   || '';
    const type   = item.asset_type    || item.type   || '';
    const serial = item.serial_number || item.serial || '';
    const loc    = item.location      || '';
    const status = item.status        || 'active';

    $tbody.append(`
      <tr data-id="${item.id}">
        <td class="cell-mono">${String(idx + 1).padStart(2, '0')}</td>
        <td><strong>${escapeHTML(name)}</strong></td>
        <td>${escapeHTML(type)}</td>
        <td class="cell-mono cell-muted">${escapeHTML(serial)}</td>
        <td>${escapeHTML(loc)}</td>
        <td>${badgeFor(status)}</td>
        <td>
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm btn-icon edit-btn" title="Edit" type="button">
              <i class="fa fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-icon del-btn" title="Delete" type="button">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`);
  });

  updateInventoryBadge();
}

function updateInventoryBadge() {
  const count = inventory.length;
  $('#inventoryBadge').text(count).toggle(count > 0);
}

/* —— SEARCH —————————————————————————————————————————————— */
$('#invSearch').on('input', debounce(function () {
  loadInventory($(this).val().trim());
}, 300));

/* —— MODAL: ADD ——————————————————————————————————————————— */
$('#btnAddEquip').on('click', function () {
  editingInventoryId = null;
  $('#modalTitle').text('Add Equipment');
  $('#fName, #fSerial, #fLocation').val('');
  $('#fType').val('');
  $('#fStatus').val('active');
  openEquipModal();
  setTimeout(() => $('#fName').focus(), 150);
});

/* —— MODAL: EDIT ————————————————————————————————————————— */
$(document).on('click', '.edit-btn', function () {
  const id   = parseInt($(this).closest('tr').data('id'));
  const item = inventory.find(i => i.id === id);
  if (!item) return;

  editingInventoryId = id;
  $('#modalTitle').text('Modifier l\'Équipement');
  $('#fName').val(item.asset_name    || item.name);
  $('#fType').val(item.asset_type    || item.type);
  $('#fSerial').val(item.serial_number || item.serial);
  $('#fLocation').val(item.location);
  $('#fStatus').val(item.status);
  openEquipModal();
});

/* —— DELETE ——————————————————————————————————————————————— */
$(document).on('click', '.del-btn', async function () {
  const id   = parseInt($(this).closest('tr').data('id'));
  const item = inventory.find(i => i.id === id);
  if (!item) return;

  const name = item.asset_name || item.name;
  if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;

  try {
    await Api.deleteAsset(id);
    inventory = inventory.filter(i => i.id !== id);
    renderInventory(inventory);
    resetDashboardCache();
    toast('Equipment removed from inventory', 'success');
  } catch(err) {
    toast('Delete failed: ' + err.message, 'error');
  }
});

/* —— SAVE (add or update) ————————————————————————————————— */
$('#modalSave').on('click', async function () {
  const name     = $('#fName').val().trim();
  const type     = $('#fType').val();
  const serial   = $('#fSerial').val().trim();
  const location = $('#fLocation').val().trim();
  const status   = $('#fStatus').val();

  let hasError = false;
  if (!name)     { highlightField('#fName');     hasError = true; }
  if (!type)     { highlightField('#fType');     hasError = true; }
  if (!serial)   { highlightField('#fSerial');   hasError = true; }
  if (!location) { highlightField('#fLocation'); hasError = true; }
  if (hasError) { toast('Please fill in all required fields', 'error'); return; }

  const payload = { asset_name: name, asset_type: type, serial_number: serial, location, status };

  $('#modalSave').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');

  try {
    if (editingInventoryId !== null) {
      await Api.updateAsset(editingInventoryId, payload);
      // Update local store
      const idx = inventory.findIndex(i => i.id === editingInventoryId);
      if (idx > -1) Object.assign(inventory[idx], { asset_name: name, asset_type: type, serial_number: serial, location, status });
      toast('Equipment updated successfully', 'success');
    } else {
      const res = await Api.addAsset(payload);
      inventory.unshift({ id: res.id, asset_name: name, asset_type: type, serial_number: serial, location, status });
      toast('Equipment added to inventory', 'success');
    }
    renderInventory(inventory);
    resetDashboardCache();
    closeEquipModal();
  } catch(err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    $('#modalSave').prop('disabled', false).html('<i class="fa fa-check"></i> Save');
  }
});

/* —— MODAL HELPERS ——————————————————————————————————————— */
function openEquipModal() {
  $('#equipModal').addClass('open');
  $(document).on('keydown.equipModal', e => { if (e.key === 'Escape') closeEquipModal(); });
}
function closeEquipModal() {
  $('#equipModal').removeClass('open');
  $(document).off('keydown.equipModal');
}
$('#modalClose, #modalCancel').on('click', closeEquipModal);
$('#equipModal').on('click', function (e) { if ($(e.target).is('#equipModal')) closeEquipModal(); });
