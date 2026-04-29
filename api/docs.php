<?php
/* ============================================================
   NEXUSIT — Documentation / KB Articles API
   GET    /api/docs.php               → list (filtered)
   POST   /api/docs.php               → create article
   PUT    /api/docs.php?id=N          → update article
   DELETE /api/docs.php?id=N          → delete article
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$method = method();

/* —— LIST ——————————————————————————————————————————————————— */
if ($method === 'GET') {
    $q   = '%' . trim($_GET['q']   ?? '') . '%';
    $cat = trim($_GET['category']  ?? '');

    $sql    = 'SELECT d.id, d.title, d.category, d.content, d.views, d.created_at,
                      u.full_name AS author_name
               FROM documentation d
               LEFT JOIN users u ON u.id = d.author_id
               WHERE d.is_published = 1
                 AND (d.title LIKE ? OR d.content LIKE ? OR d.category LIKE ?)';
    $params = [$q, $q, $q];

    if ($cat) { $sql .= ' AND d.category = ?'; $params[] = $cat; }
    $sql .= ' ORDER BY d.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok($stmt->fetchAll());
}

/* —— CREATE ———————————————————————————————————————————————— */
if ($method === 'POST') {
    $b        = body();
    $title    = trim($b['title']    ?? '');
    $category = trim($b['category'] ?? '');
    $content  = trim($b['content']  ?? '');
    $icon     = trim($b['icon']     ?? 'fa-file-lines');

    if (!$title || !$category || !$content)
        json_err('Title, category, and content are required.');

    $ins = db()->prepare(
        'INSERT INTO documentation (title, category, content, author_id)
         VALUES (?, ?, ?, ?)'
    );
    $ins->execute([$title, $category, $content, $_SESSION['user_id']]);
    $newId = db()->lastInsertId();

    json_ok(['id' => $newId, 'icon' => $icon, 'message' => 'Article created.'], 201);
}

/* —— UPDATE ———————————————————————————————————————————————— */
if ($method === 'PUT') {
    if (!$id) json_err('Missing id parameter.');
    $b        = body();
    $title    = trim($b['title']    ?? '');
    $category = trim($b['category'] ?? '');
    $content  = trim($b['content']  ?? '');

    if (!$title || !$category || !$content)
        json_err('Title, category, and content are required.');

    db()->prepare(
        'UPDATE documentation SET title=?, category=?, content=? WHERE id=?'
    )->execute([$title, $category, $content, $id]);

    json_ok(['message' => 'Article updated.']);
}

/* —— BUMP VIEW COUNT ——————————————————————————————————————— */
if ($method === 'PATCH') {
    if (!$id) json_err('Missing id parameter.');
    db()->prepare('UPDATE documentation SET views = views + 1 WHERE id = ?')->execute([$id]);
    json_ok(['message' => 'View counted.']);
}

/* —— DELETE ———————————————————————————————————————————————— */
if ($method === 'DELETE') {
    if (!$id) json_err('Missing id parameter.');
    $r = db()->prepare('SELECT id FROM documentation WHERE id = ? LIMIT 1');
    $r->execute([$id]);
    if (!$r->fetch()) json_err('Article not found.', 404);
    db()->prepare('DELETE FROM documentation WHERE id = ?')->execute([$id]);
    json_ok(['message' => 'Article deleted.']);
}

json_err('Method not allowed.', 405);
