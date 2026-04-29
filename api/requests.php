<?php
/* ============================================================
   NEXUSIT — Requests & Complaints API
   GET    /api/requests.php           → list
   POST   /api/requests.php           → submit new request
   PUT    /api/requests.php?id=N      → update status
   DELETE /api/requests.php?id=N      → delete
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$method = method();

/* —— LIST ——————————————————————————————————————————————————— */
if ($method === 'GET') {
    session_write_close(); // release session lock — allows concurrent requests
    $stmt = db()->query(
        "SELECT r.*, u.full_name AS submitted_by_name
         FROM requests r
         LEFT JOIN users u ON u.id = r.submitted_by
         ORDER BY r.created_at DESC"
    );
    $rows = $stmt->fetchAll();

    /* Status map: DB value → consistent English display label */
    $statusLabel = [
        'pending'     => 'Pending',
        'open'        => 'Pending',
        'in_review'   => 'In Review',
        'in_progress' => 'In Progress',
        'resolved'    => 'Resolved',
        'rejected'    => 'Rejected',
        'closed'      => 'Closed',
        'cancelled'   => 'Cancelled',
    ];

    $out = array_map(function ($r) use ($statusLabel) {
        return [
            'id'         => $r['id'],
            'name'       => $r['full_name'],
            'email'      => $r['email'],
            'type'       => $r['request_type'],
            'dept'       => $r['department'],
            'subject'    => $r['subject'],
            'details'    => $r['details'] ?? '',
            'status'     => $statusLabel[$r['status']] ?? ucfirst($r['status']),
            'priority'   => ucfirst($r['priority'] ?? 'normal'),
            'created_at' => $r['created_at'],
        ];
    }, $rows);

    json_ok($out);
}

/* —— CREATE ————————————————————————————————————————————————— */
if ($method === 'POST') {
    $b        = body();
    $name     = trim($b['name']     ?? '');
    $email    = trim($b['email']    ?? '');
    $type     = trim($b['type']     ?? '');
    $dept     = trim($b['dept']     ?? '');
    $subject  = trim($b['subject']  ?? '');
    $details  = trim($b['details']  ?? '');
    $priority = strtolower(trim($b['priority'] ?? 'medium'));
    $device   = trim($b['device']   ?? '');

    if (!$name || !$email || !$type || !$dept || !$subject)
        json_err('Name, email, type, department and subject are required.');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        json_err('Invalid email address.');

    $validPriorities = ['low', 'medium', 'high', 'critical', 'normal'];
    if (!in_array($priority, $validPriorities)) $priority = 'medium';

    if ($device) $details = ($details ? $details . "\n" : '') . "Device: $device";

    $ins = db()->prepare(
        'INSERT INTO requests (submitted_by, full_name, email, request_type, department, subject, details, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([$_SESSION['user_id'], $name, $email, $type, $dept, $subject, $details, $priority]);
    $newId = db()->lastInsertId();

    db()->prepare(
        "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
         VALUES (?, 'request_submitted', ?, 'request', ?)"
    )->execute([$_SESSION['user_id'], "New $type submitted by $name: $subject", $newId]);

    json_ok(['id' => $newId, 'message' => 'Request submitted successfully.'], 201);
}

/* —— UPDATE STATUS ——————————————————————————————————————— */
if ($method === 'PUT') {
    if (!$id) json_err('Missing id parameter.');
    $b = body();

    // Normalise: accept any label the frontend might send
    $raw     = strtolower(trim(str_replace(' ', '_', $b['status'] ?? '')));
    $aliases = [
        'open'        => 'pending',   // "Open"        → DB 'pending'
        'in_progress' => 'in_review', // "In Progress" → DB 'in_review'
        'closed'      => 'rejected',
        'cancelled'   => 'rejected',
    ];
    $status = $aliases[$raw] ?? $raw;

    $validStatuses = ['pending', 'in_review', 'resolved', 'rejected'];
    if (!in_array($status, $validStatuses))
        json_err('Invalid status. Accepted: Pending, In Review, Resolved, Rejected.');

    $priority        = strtolower(trim($b['priority'] ?? ''));
    $validPriorities = ['low', 'medium', 'high', 'critical', 'normal'];

    $fields = ['status = ?'];
    $params = [$status];
    if ($priority && in_array($priority, $validPriorities)) {
        $fields[] = 'priority = ?';
        $params[] = $priority;
    }
    $params[] = $id;

    db()->prepare('UPDATE requests SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    // Sync linked ticket status if ticket_id column exists
    try {
        $reqData = db()->prepare('SELECT ticket_id FROM requests WHERE id = ? LIMIT 1');
        $reqData->execute([$id]);
        $row = $reqData->fetch();

        if ($row && !empty($row['ticket_id'])) {
            $tktMap = [
                'pending'   => 'open',
                'in_review' => 'in_progress',
                'resolved'  => 'resolved',
                'rejected'  => 'cancelled',
            ];
            $tStatus  = $tktMap[$status] ?? 'open';
            $tParams  = [$tStatus];
            $pExtra   = '';

            if ($priority && in_array($priority, ['low', 'medium', 'high', 'critical'])) {
                $pExtra    = ', priority = ?';
                $tParams[] = $priority;
            }
            $resolvedAt = ($tStatus === 'resolved') ? ', resolved_at = NOW()' : '';
            $tParams[]  = $row['ticket_id'];

            db()->prepare("UPDATE tickets SET status = ? $pExtra $resolvedAt WHERE id = ?")
               ->execute($tParams);
        }
    } catch (\Throwable $e) {
        error_log('[NexusIT] ticket sync skipped: ' . $e->getMessage());
    }

    json_ok(['message' => 'Request status updated.']);
}

/* —— DELETE ————————————————————————————————————————————————— */
if ($method === 'DELETE') {
    if (!$id) json_err('Missing id parameter.');
    $r = db()->prepare('SELECT id FROM requests WHERE id = ? LIMIT 1');
    $r->execute([$id]);
    if (!$r->fetch()) json_err('Request not found.', 404);
    db()->prepare('DELETE FROM requests WHERE id = ?')->execute([$id]);
    json_ok(['message' => 'Request deleted.']);
}

json_err('Method not allowed.', 405);
