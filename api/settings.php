<?php
/* ============================================================
   NEXUSIT — Settings API
   GET  /api/settings.php?action=profile   → get current admin profile
   PUT  /api/settings.php?action=profile   → update name/email/password
   POST /api/settings.php?action=clear     → reset all non-auth data
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);
if ($_SESSION['user_role'] !== 'admin') json_err('Admin access required.', 403);

$action = $_GET['action'] ?? '';
$method = method();

/* —— GET PROFILE ————————————————————————————————————————— */
if ($action === 'profile' && $method === 'GET') {
    $stmt = db()->prepare('SELECT id, full_name, email, department FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    json_ok($stmt->fetch());
}

/* —— UPDATE PROFILE ————————————————————————————————————— */
if ($action === 'profile' && $method === 'PUT') {
    $b     = body();
    $name  = trim($b['full_name'] ?? '');
    $email = strtolower(trim($b['email'] ?? ''));
    $pass  = $b['new_password']  ?? '';
    $conf  = $b['confirm_password'] ?? '';

    if (!$name) json_err('Display name is required.');
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Invalid email address.');

    if ($pass) {
        if (strlen($pass) < 6)   json_err('Password must be at least 6 characters.');
        if ($pass !== $conf)      json_err('Passwords do not match.');
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($pass, PASSWORD_BCRYPT), $_SESSION['user_id']]);
    }

    $fields = ['full_name = ?'];
    $params = [$name];
    if ($email) { $fields[] = 'email = ?'; $params[] = $email; }
    $params[] = $_SESSION['user_id'];

    db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    json_ok(['message' => 'Settings saved.']);
}

/* —— CLEAR DATA ————————————————————————————————————————— */
if ($action === 'clear' && $method === 'POST') {
    $pdo = db();

    // Disable foreign key checks during truncation
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

    // Truncate all data tables — keep users & sessions intact
    foreach (['inventory', 'tickets', 'ticket_comments', 'requests', 'issues', 'documentation', 'activity_log'] as $tbl) {
        $pdo->exec("TRUNCATE TABLE `$tbl`");
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    json_ok(['message' => 'All data cleared. Users and credentials preserved.']);
}

json_err('Invalid action or method.', 404);
