<?php
/* ============================================================
   NEXUSIT — Inventory API
   GET    /api/inventory.php          → list all
   POST   /api/inventory.php          → create
   PUT    /api/inventory.php?id=N     → update
   DELETE /api/inventory.php?id=N     → delete
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$method = method();

/* —— LIST ———————————————————————————————————————————————————— */
if ($method === 'GET') {
    $q    = '%' . trim($_GET['q'] ?? '') . '%';
    $stmt = db()->prepare(
        "SELECT i.*, u.full_name AS assigned_to_name
         FROM inventory i
         LEFT JOIN users u ON u.id = i.assigned_to
         WHERE i.asset_name LIKE ? OR i.asset_type LIKE ?
            OR i.serial_number LIKE ? OR i.location LIKE ?
         ORDER BY i.id DESC"
    );
    $stmt->execute([$q, $q, $q, $q]);
    json_ok($stmt->fetchAll());
}

/* —— CREATE ——————————————————————————————————————————————— */
if ($method === 'POST') {
    $b = body();
    $name   = trim($b['asset_name']    ?? '');
    $type   = trim($b['asset_type']    ?? '');
    $serial = trim($b['serial_number'] ?? '');
    $loc    = trim($b['location']      ?? '');
    $status = trim($b['status']        ?? 'active');

    if (!$name || !$type || !$serial || !$loc)
        json_err('Name, type, serial number, and location are required.');

    // Check duplicate serial
    $chk = db()->prepare('SELECT id FROM inventory WHERE serial_number = ? LIMIT 1');
    $chk->execute([$serial]);
    if ($chk->fetch()) json_err('Serial number already exists in inventory.');

    $ins = db()->prepare(
        'INSERT INTO inventory (asset_name, asset_type, serial_number, location, status, assigned_to, purchase_date, warranty_expiry, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
        $name, $type, $serial, $loc, $status,
        $b['assigned_to']      ? (int)$b['assigned_to']      : null,
        $b['purchase_date']    ?: null,
        $b['warranty_expiry']  ?: null,
        trim($b['notes'] ?? '') ?: null,
    ]);
    $newId = db()->lastInsertId();

    // Log
    db()->prepare(
        "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
         VALUES (?, 'asset_added', ?, 'inventory', ?)"
    )->execute([$_SESSION['user_id'], "New asset added: $name ($serial)", $newId]);

    json_ok(['id' => $newId, 'message' => 'Equipment added.'], 201);
}

/* —— UPDATE ——————————————————————————————————————————————— */
if ($method === 'PUT') {
    if (!$id) json_err('Missing id parameter.');
    $b = body();

    $name   = trim($b['asset_name']    ?? '');
    $type   = trim($b['asset_type']    ?? '');
    $serial = trim($b['serial_number'] ?? '');
    $loc    = trim($b['location']      ?? '');
    $status = trim($b['status']        ?? 'active');

    if (!$name || !$type || !$serial || !$loc)
        json_err('Name, type, serial number, and location are required.');

    // Check serial uniqueness (excluding self)
    $chk = db()->prepare('SELECT id FROM inventory WHERE serial_number = ? AND id != ? LIMIT 1');
    $chk->execute([$serial, $id]);
    if ($chk->fetch()) json_err('Serial number already used by another asset.');

    $upd = db()->prepare(
        'UPDATE inventory SET asset_name=?, asset_type=?, serial_number=?, location=?, status=?,
         assigned_to=?, purchase_date=?, warranty_expiry=?, notes=?
         WHERE id = ?'
    );
    $upd->execute([
        $name, $type, $serial, $loc, $status,
        $b['assigned_to']     ? (int)$b['assigned_to']     : null,
        $b['purchase_date']   ?: null,
        $b['warranty_expiry'] ?: null,
        trim($b['notes'] ?? '') ?: null,
        $id,
    ]);

    db()->prepare(
        "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
         VALUES (?, 'asset_updated', ?, 'inventory', ?)"
    )->execute([$_SESSION['user_id'], "Asset updated: $name", $id]);

    json_ok(['message' => 'Equipment updated.']);
}

/* —— DELETE ——————————————————————————————————————————————— */
if ($method === 'DELETE') {
    if (!$id) json_err('Missing id parameter.');

    $item = db()->prepare('SELECT asset_name FROM inventory WHERE id = ? LIMIT 1');
    $item->execute([$id]);
    $row = $item->fetch();
    if (!$row) json_err('Equipment not found.', 404);

    db()->prepare('DELETE FROM inventory WHERE id = ?')->execute([$id]);

    db()->prepare(
        "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
         VALUES (?, 'asset_deleted', ?, 'inventory', ?)"
    )->execute([$_SESSION['user_id'], "Asset removed: {$row['asset_name']}", $id]);

    json_ok(['message' => 'Equipment deleted.']);
}

json_err('Method not allowed.', 405);
