<?php
/* ============================================================
   NEXUSIT — Auth API
   POST /api/auth.php?action=login
   POST /api/auth.php?action=register
   POST /api/auth.php?action=logout
   GET  /api/auth.php?action=me
   PUT  /api/auth.php?action=profile
   ============================================================ */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

/* —— LOGIN ——————————————————————————————————————————————————— */
if ($action === 'login' && method() === 'POST') {
    $b     = body();
    $email = strtolower(trim($b['email']    ?? ''));
    $pass  = $b['password'] ?? '';

    if (!$email || !$pass)
        json_err('Email and password are required.');

    $stmt = db()->prepare(
        'SELECT id, full_name, email, password_hash, role, department, avatar_initials
         FROM users WHERE email = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pass, $user['password_hash']))
        json_err('Incorrect email or password.', 401);

    // Persist session
    $_SESSION['user_id']   = $user['id'];
    $_SESSION['user_role'] = $user['role'];

    // Log activity (non-fatal)
    try {
        db()->prepare(
            "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
             VALUES (?, 'user_login', ?, 'user', ?)"
        )->execute([$user['id'], "User logged in: {$user['full_name']}", $user['id']]);
    } catch (\Throwable $e) {
        error_log('[NexusIT] activity_log login failed: ' . $e->getMessage());
    }

    unset($user['password_hash']);
    json_ok($user);
}

/* —— REGISTER ————————————————————————————————————————————— */
if ($action === 'register' && method() === 'POST') {
    $b     = body();
    $name  = trim($b['full_name']   ?? '');
    $email = strtolower(trim($b['email']  ?? ''));
    $pass  = $b['password']  ?? '';
    $dept  = trim($b['department']  ?? '');

    if (!$name || !$email || !$dept || strlen($pass) < 6)
        json_err('All fields are required. Password must be at least 6 characters.');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        json_err('Invalid email address.');

    $chk = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $chk->execute([$email]);
    if ($chk->fetch())
        json_err('This email is already registered.');

    $hash     = password_hash($pass, PASSWORD_BCRYPT);
    $parts    = explode(' ', trim($name));
    $initials = strtoupper(substr($parts[0], 0, 1) . (count($parts) > 1 ? substr(end($parts), 0, 1) : ''));

    $ins = db()->prepare(
        'INSERT INTO users (full_name, email, password_hash, role, department, avatar_initials)
         VALUES (?, ?, ?, "employee", ?, ?)'
    );
    $ins->execute([$name, $email, $hash, $dept, $initials]);
    $newId = db()->lastInsertId();

    try {
        db()->prepare(
            "INSERT INTO activity_log (user_id, action_type, description, entity_type, entity_id)
             VALUES (?, 'user_registered', ?, 'user', ?)"
        )->execute([$newId, "New employee registered: $name", $newId]);
    } catch (\Throwable $e) {}

    json_ok(['id' => $newId, 'message' => 'Account created successfully.'], 201);
}

/* —— LOGOUT ——————————————————————————————————————————————— */
if ($action === 'logout' && method() === 'POST') {
    session_destroy();
    json_ok(['message' => 'Logged out.']);
}

/* —— ME (current session user) ————————————————————————— */
if ($action === 'me' && method() === 'GET') {
    if (empty($_SESSION['user_id']))
        json_err('Not authenticated.', 401);

    $uid = (int)$_SESSION['user_id'];
    session_write_close(); // Release lock immediately — GET is read-only

    $stmt = db()->prepare(
        'SELECT id, full_name, email, role, department, avatar_initials, created_at
         FROM users WHERE id = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->execute([$uid]);
    $user = $stmt->fetch();
    if (!$user)
        json_err('User not found.', 404);
    json_ok($user);
}

/* —— UPDATE PROFILE ————————————————————————————————————— */
if ($action === 'profile' && method() === 'PUT') {
    if (empty($_SESSION['user_id']))
        json_err('Not authenticated.', 401);

    $b       = body();
    $name    = trim($b['full_name']    ?? '');
    $dept    = trim($b['department']   ?? '');
    $newPass = $b['new_password']      ?? '';

    if (!$name)
        json_err('Name cannot be empty.');

    $fields = ['full_name = ?', 'department = ?'];
    $params = [$name, $dept];

    if ($newPass) {
        if (strlen($newPass) < 6)
            json_err('Password must be at least 6 characters.');
        $fields[] = 'password_hash = ?';
        $params[] = password_hash($newPass, PASSWORD_BCRYPT);
    }

    $params[] = $_SESSION['user_id'];
    db()->prepare(
        'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?'
    )->execute($params);

    json_ok(['message' => 'Profile updated.']);
}

json_err('Invalid action or method.', 404);
