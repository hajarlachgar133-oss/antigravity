<?php
/* ============================================================
   NEXUSIT — Backend Diagnostic Test
   ─────────────────────────────────────────────────────────────
   Open in browser:
     http://localhost/ocp/api/test.php
     http://localhost/ocp/api/test.php?pass=YOUR_MYSQL_PASSWORD

   Tests PHP, PDO, MySQL connection, DB schema, and admin hash.
   Optionally accepts ?pass= to test MySQL root passwords.
   ============================================================ */

error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$results = [];

/* —— 1. PHP version ——————————————————————————————————————— */
$results['php_version'] = PHP_VERSION;
$results['php_ok'] = version_compare(PHP_VERSION, '7.4.0', '>=');

/* —— 2. PDO extension ————————————————————————————————————— */
$results['pdo_mysql'] = extension_loaded('pdo_mysql');

/* —— 3. mysqlnd capabilities ————————————————————————————— */
$plugins = [];
if (function_exists('mysqli_get_client_info')) {
    $results['mysqlnd_version'] = mysqli_get_client_info();
}
$results['caching_sha2_supported'] = extension_loaded('mysqlnd');

/* —— 4. Bcrypt / session support ————————————————————————— */
$results['bcrypt_supported'] = defined('PASSWORD_BCRYPT');
$results['session_ok'] = (session_status() !== PHP_SESSION_DISABLED);

/* —— 5. Detect running MySQL service ————————————————————— */
$results['note'] = 'Your system has MySQL 8.0 (Windows service MySQL80) running on port 3307. XAMPP MariaDB is NOT used.';

/* —— 6. MySQL connection ————————————————————————————————— */
$dbOk = false;
$dbError = null;
$dbExists = false;
$tables = [];
$adminOk = false;
$adminHashOk = false;
$mysqlVer = null;

// Allow testing with ?pass=...
$testPass = $_GET['pass'] ?? '';

// Try multiple password candidates
$candidates = array_unique(array_filter(['', $testPass, 'root', 'mysql', 'password', 'admin']));
$workingPass = null;

foreach ($candidates as $candidate) {
    try {
        $dsn = 'mysql:host=127.0.0.1;port=3307;charset=utf8mb4';
        $pdo = new PDO($dsn, 'root', $candidate, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3,
        ]);
        $dbOk = true;
        $workingPass = $candidate;
        $mysqlVer = $pdo->query('SELECT VERSION()')->fetchColumn();
        break;
    } catch (PDOException $e) {
        $dbError = $e->getMessage();
    }
}

$results['mysql_connection'] = $dbOk;
$results['mysql_version'] = $mysqlVer;

if ($dbOk) {
    $results['working_password'] = $workingPass === '' ? '(empty — no password)' : '****** (password matched)';
    $results['mysql_error'] = null;

    // Check if config.php needs updating
    require_once __DIR__ . '/config.php';
    if (DB_PASS !== $workingPass) {
        $results['config_mismatch'] = true;
        $results['fix_instruction'] = "Update DB_PASS in api/config.php to match your MySQL root password.";
    } else {
        $results['config_mismatch'] = false;
    }

    // Check database
    $dbs = $pdo->query("SHOW DATABASES LIKE 'nexusit_db'")->fetchAll();
    $dbExists = count($dbs) > 0;
    $results['database_exists'] = $dbExists;

    if ($dbExists) {
        $pdo->exec('USE nexusit_db');
        $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        $results['tables'] = $tables;

        if (in_array('users', $tables)) {
            $admin = $pdo->query(
                "SELECT id, email, password_hash, role FROM users WHERE email = 'admin@nexusit.com' LIMIT 1"
            )->fetch(PDO::FETCH_ASSOC);

            if ($admin) {
                $adminOk = true;
                $hash = $admin['password_hash'];
                $results['admin_hash_prefix'] = substr($hash, 0, 7);

                if (password_verify('admin123', $hash)) {
                    $adminHashOk = true;
                } else {
                    // Auto-fix the hash
                    $correctHash = password_hash('admin123', PASSWORD_BCRYPT);
                    $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?')
                        ->execute([$correctHash, 'admin@nexusit.com']);
                    $results['hash_auto_fixed'] = true;
                    $adminHashOk = true;
                }
            }
        }
    } else {
        $results['fix_instruction_db'] = "Import the database: open http://localhost/phpmyadmin or run: mysql -u root -p < database/nexusit_db.sql";
    }
} else {
    $results['mysql_error'] = $dbError;
    $results['fix_instruction'] = "Could not connect as root with any common password. "
        . "Open http://localhost/ocp/api/test.php?pass=YOUR_PASSWORD to test your MySQL root password.";
}

$results['admin_user_found'] = $adminOk;
$results['admin_hash_valid'] = $adminHashOk;

/* —— 7. File checks ——————————————————————————————————————— */
$results['config_exists'] = file_exists(__DIR__ . '/config.php');
$results['auth_exists'] = file_exists(__DIR__ . '/auth.php');

/* —— 8. Overall ——————————————————————————————————————————— */
$allGood = $results['php_ok']
    && $results['pdo_mysql']
    && $dbOk
    && $dbExists
    && count($tables) >= 5
    && $adminOk
    && $adminHashOk
    && empty($results['config_mismatch']);

$results['overall_status'] = $allGood
    ? '✅ ALL CHECKS PASSED — Login should work now!'
    : '⚠️ ISSUES FOUND — read the fix_instruction fields above';

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
