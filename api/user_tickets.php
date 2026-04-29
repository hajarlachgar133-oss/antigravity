<?php
/* ============================================================
   NEXUSIT — User Tickets API  (employee portal)
   GET    /api/user_tickets.php        → tickets for logged-in user
   POST   /api/user_tickets.php        → submit a new ticket
   PUT    /api/user_tickets.php?id=N   → admin updates ticket status
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$userId = (int)$_SESSION['user_id'];
$role   = $_SESSION['user_role'] ?? 'employee';
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$method = method();

/* —— LIST ——————————————————————————————————————————————————— */
if ($method === 'GET') {
    // Admin sees all; employee sees only own
    if ($role === 'admin') {
        $stmt = db()->query(
            "SELECT t.*, u.full_name AS submitted_by_name, u.department,
                    inv.asset_name AS device_name
             FROM tickets t
             LEFT JOIN users u   ON u.id   = t.submitted_by
             LEFT JOIN inventory inv ON inv.id = t.device_id
             ORDER BY FIELD(t.priority,'critical','high','medium','low'), t.created_at DESC"
        );
    } else {
        $stmt = db()->prepare(
            "SELECT t.*, inv.asset_name AS device_name
             FROM tickets t
             LEFT JOIN inventory inv ON inv.id = t.device_id
             WHERE t.submitted_by = ?
             ORDER BY t.created_at DESC"
        );
        $stmt->execute([$userId]);
    }

    $rows = $stmt->fetchAll();

    // Normalize for frontend
    $out = array_map(function($t) {
        return [
            'id'        => $t['id'],
            'ticket_ref'=> $t['ticket_ref'],
            'subject'   => $t['subject'],
            'type'      => $t['category'] ?? 'General',
            'priority'  => ucfirst($t['priority']),
            'dept'      => $t['department'] ?? '—',
            'status'    => ucwords(str_replace('_', ' ', $t['status'])),
            'device'    => $t['device_name'] ?? '',
            'submitted' => date('d/m/Y', strtotime($t['created_at'])),
            'name'      => $t['submitted_by_name'] ?? '',
            'email'     => $t['email'] ?? '',
        ];
    }, $rows);

    json_ok($out);
}

/* —— CREATE (employee submits ticket) ————————————————————— */
if ($method === 'POST') {
    $b        = body();
    $subject  = trim($b['subject']  ?? '');
    $type     = trim($b['type']     ?? 'General');
    $dept     = trim($b['dept']     ?? '');
    $details  = trim($b['details']  ?? '');
    $priority = strtolower(trim($b['priority'] ?? 'low'));
    $device   = trim($b['device']   ?? '');

    if (!$subject || !$dept) json_err('Subject and department are required.');

    // Generate unique ticket ref (e.g. TKT-20260001)
    $maxId  = (int)db()->query('SELECT IFNULL(MAX(id),0) FROM tickets')->fetchColumn();
    $nextId = $maxId + 1;
    $tktRef = 'TKT-' . date('Y') . str_pad($nextId, 4, '0', STR_PAD_LEFT);
    
    // Ensure uniqueness
    while ((int)db()->query("SELECT COUNT(*) FROM tickets WHERE ticket_ref = '$tktRef'")->fetchColumn() > 0) {
        $nextId++;
        $tktRef = 'TKT-' . date('Y') . str_pad($nextId, 4, '0', STR_PAD_LEFT);
    }

    // Look up device in inventory if name provided
    $deviceId = null;
    if ($device) {
        $dq = db()->prepare(
            "SELECT id FROM inventory WHERE asset_name LIKE ? OR serial_number LIKE ? LIMIT 1"
        );
        $dq->execute(["%$device%", "%$device%"]);
        $drow = $dq->fetch();
        if ($drow) $deviceId = $drow['id'];
    }

    // Get submitter email
    $uStmt = db()->prepare('SELECT email, department FROM users WHERE id = ? LIMIT 1');
    $uStmt->execute([$userId]);
    $uRow = $uStmt->fetch();

    $ins = db()->prepare(
        'INSERT INTO tickets (ticket_ref, submitted_by, subject, description, category, priority, status, device_id)
         VALUES (?, ?, ?, ?, ?, ?, "open", ?)'
    );
    $ins->execute([$tktRef, $userId, $subject, $details, $type, $priority, $deviceId]);
    $newId = db()->lastInsertId();

    // Mirror as a request/complaint entry in the requests table
    $uDept    = $uRow['department'] ?? $dept;
    $uEmail   = $uRow['email']      ?? '';

    // Fetch full_name
    $uName   = db()->prepare('SELECT full_name FROM users WHERE id = ? LIMIT 1');
    $uName->execute([$userId]);
    $nameRow  = $uName->fetch();
    $fullName = $nameRow['full_name'] ?? 'Employee';

    // Map front-end ticket type → requests.request_type ENUM
    // Valid DB values: 'Request', 'Complaint', 'Incident', 'Change Request'
    $reqTypeMap  = [
        'Complaint'      => 'Complaint',
        'Incident'       => 'Incident',
        'Change Request' => 'Change Request',
    ];
    $reqTypeEnum = $reqTypeMap[$type] ?? 'Request';

    // Attempt full insert (with ticket_id).  Fall back without it if the
    // column doesn't exist in the live DB (avoids crashing the whole request).
    try {
        db()->prepare(
            'INSERT INTO requests
                (ticket_id, submitted_by, full_name, email, request_type, department, subject, details, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$newId, $userId, $fullName, $uEmail, $reqTypeEnum, $uDept,
                    "[$priority] $subject", $details, $priority]);
    } catch (\Throwable $e) {
        // Fallback: insert without ticket_id (handles missing column in older DBs)
        try {
            db()->prepare(
                'INSERT INTO requests
                    (submitted_by, full_name, email, request_type, department, subject, details, priority)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([$userId, $fullName, $uEmail, $reqTypeEnum, $uDept,
                        "[$priority] $subject", $details, $priority]);
        } catch (\Throwable $e2) {
            // Log but never crash the ticket submission
            error_log('[NexusIT] requests mirror failed: ' . $e2->getMessage());
        }
    }

    // Activity log (non-fatal)
    try {
        db()->prepare(
            "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
             VALUES (?, 'ticket_created', ?, 'ticket', ?)"
        )->execute([$userId, "Ticket $tktRef submitted: $subject", $newId]);
    } catch (\Throwable $e) {
        error_log('[NexusIT] activity_log failed: ' . $e->getMessage());
    }

    json_ok(['id' => $newId, 'ticket_ref' => $tktRef, 'message' => "Ticket $tktRef submitted."], 201);
}

/* —— UPDATE STATUS (admin) ———————————————————————————————— */
if ($method === 'PUT') {
    if (!$id) json_err('Missing id parameter.');

    $b      = body();
    $status = strtolower(str_replace(' ', '_', $b['status'] ?? ''));

    $valid = ['open','in_progress','resolved','closed','cancelled'];
    if (!in_array($status, $valid))
        json_err('Invalid status. Valid: ' . implode(', ', $valid));

    $extra = ($status === 'resolved') ? ', resolved_at = NOW()' : '';
    db()->prepare("UPDATE tickets SET status = ? $extra WHERE id = ?")->execute([$status, $id]);

    json_ok(['message' => 'Ticket status updated.']);
}

json_err('Method not allowed.', 405);
