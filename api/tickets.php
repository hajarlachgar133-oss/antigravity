<?php
/* ============================================================
   NEXUSIT — Tickets (Troubleshooting) API
   GET    /api/tickets.php            → list
   POST   /api/tickets.php            → create
   PUT    /api/tickets.php?id=N       → update status/response
   DELETE /api/tickets.php?id=N       → delete
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$method = method();

/* —— LIST ——————————————————————————————————————————————————— */
if ($method === 'GET') {
    $q  = '%' . trim($_GET['q'] ?? '') . '%';
    $st = $_GET['status'] ?? '';

    $sql    = "SELECT i.id, i.title AS problem, i.description AS `desc`,
                      i.status, COALESCE(i.response_notes,'') AS response,
                      u.full_name AS assigned_to_name, i.created_at
               FROM issues i
               LEFT JOIN users u ON u.id = i.assigned_to
               WHERE (i.title LIKE ? OR i.description LIKE ?)";
    $params = [$q, $q];

    if ($st) { $sql .= ' AND i.status = ?'; $params[] = $st; }
    $sql .= ' ORDER BY FIELD(i.status,"critical","in-progress","pending","resolved"), i.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok($stmt->fetchAll());
}

/* —— CREATE ————————————————————————————————————————————————— */
if ($method === 'POST') {
    $b    = body();
    $title = trim($b['problem'] ?? $b['title'] ?? '');
    $desc  = trim($b['desc']    ?? $b['description'] ?? '');
    $status= trim($b['status']  ?? 'pending');

    if (!$title) json_err('Problem title is required.');

    $ins = db()->prepare(
        'INSERT INTO issues (title, description, status, response_notes, reported_by)
         VALUES (?, ?, ?, ?, ?)'
    );
    $ins->execute([$title, $desc, $status, trim($b['response'] ?? '') ?: null, $_SESSION['user_id']]);
    $newId = db()->lastInsertId();

    db()->prepare(
        "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
         VALUES (?, 'issue_created', ?, 'issue', ?)"
    )->execute([$_SESSION['user_id'], "New issue logged: $title", $newId]);

    json_ok(['id' => $newId, 'message' => 'Issue created.'], 201);
}

/* —— UPDATE ————————————————————————————————————————————————— */
if ($method === 'PUT') {
    if (!$id) json_err('Missing id parameter.');
    $b = body();

    // Fetch current record to allow partial updates
    $cur = db()->prepare('SELECT title, description, status, response_notes FROM issues WHERE id=? LIMIT 1');
    $cur->execute([$id]);
    $row = $cur->fetch();
    if (!$row) json_err('Issue not found.', 404);

    $title    = trim($b['problem']  ?? $b['title'] ?? $row['title']);
    $desc     = trim($b['desc']     ?? $b['description'] ?? $row['description'] ?? '');
    $status   = trim($b['status']   ?? $row['status']);
    $response = trim($b['response'] ?? $b['response_notes'] ?? $row['response_notes'] ?? '');

    if (!$title)  json_err('Problem title is required.');
    if (!$status) json_err('Status is required.');

    db()->prepare(
        'UPDATE issues SET title=?, description=?, status=?, response_notes=? WHERE id=?'
    )->execute([$title, $desc, $status, $response ?: null, $id]);

    json_ok(['message' => 'Issue updated.']);
}

/* —— DELETE ———————————————————————————————————————————————— */
if ($method === 'DELETE') {
    if (!$id) json_err('Missing id parameter.');
    $r = db()->prepare('SELECT title FROM issues WHERE id=? LIMIT 1');
    $r->execute([$id]);
    if (!$r->fetch()) json_err('Issue not found.', 404);
    db()->prepare('DELETE FROM issues WHERE id=?')->execute([$id]);
    json_ok(['message' => 'Issue deleted.']);
}

json_err('Method not allowed.', 405);
