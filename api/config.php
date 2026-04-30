<?php
/* ============================================================
   NEXUSIT — Database Configuration
   ============================================================ */

/* —— Development error reporting ——————————————————————————
   Forces PHP to output all errors so empty-response bugs are
   immediately visible.  DISABLE in production.
   ─────────────────────────────────────────────────────────── */
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');

/* —— Output buffering ————————————————————————————————————
   Catches any accidental echo / whitespace before headers.
   Flushed naturally when the script exits.
   ─────────────────────────────────────────────────────────── */
ob_start();

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3307');
define('DB_NAME', 'nexusit_db');
define('DB_USER', 'root');

/*  ╔══════════════════════════════════════════════════════════╗
 *  ║  ⚠  SET YOUR MYSQL ROOT PASSWORD BELOW ⚠              ║
 *  ║  Your system uses MySQL 8.0 (service: MySQL80).        ║
 *  ║  Enter the password you chose during MySQL 8 setup.    ║
 *  ║  Test it: http://localhost/ocp/api/test.php?pass=XXX   ║
 *  ╚══════════════════════════════════════════════════════════╝ */
define('DB_PASS', '');            // ← PUT YOUR MYSQL ROOT PASSWORD HERE

define('DB_CHARSET', 'utf8mb4');

/* —— Development mode: Use mock database if MySQL unavailable ——— */
define('USE_MOCK_DB', getenv('USE_MOCK_DB') === 'true' || !isPortOpen(DB_HOST, DB_PORT));

function isPortOpen($host, $port, $timeout = 1) {
    $fp = @fsockopen($host, $port, $errno, $errstr, $timeout);
    if ($fp) {
        fclose($fp);
        return true;
    }
    return false;
}

/* —— Global exception & error handler ——————————————————————
   Ensures ANY uncaught error returns valid JSON instead of
   an empty body or an HTML error page.
   ─────────────────────────────────────────────────────────── */
set_exception_handler(function (Throwable $e) {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    $message = mb_convert_encoding($e->getMessage(), 'UTF-8', 'auto');
    echo json_encode([
        'success' => false,
        'error' => 'Server error: ' . $message,
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
});

set_error_handler(function (int $errno, string $errstr) {
    throw new \ErrorException($errstr, 0, $errno);
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        ob_end_clean(); // Clean any previous buffering
        echo json_encode([
            'success' => false,
            'error' => 'Fatal Error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }
});

/**
 * Return a singleton PDO connection or MockPDO for development.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        // Use mock database if MySQL is unavailable
        if (USE_MOCK_DB) {
            require_once __DIR__ . '/MockDatabase.php';
            $pdo = new MockPDO(__DIR__ . '/../data/mock_db.json');
            return $pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST,
            DB_PORT,
            DB_NAME,
            DB_CHARSET
        );
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (\PDOException $e) {
            http_response_code(503);
            $hint = (strpos($e->getMessage(), '1045') !== false)
                ? ' Your MySQL root password is likely wrong — update DB_PASS in api/config.php. Test it: http://localhost/ocp/api/test.php?pass=YOUR_PASSWORD'
                : (strpos($e->getMessage(), '2002') !== false
                    ? ' MySQL/MariaDB is not running. Falling back to mock database. Start MySQL from XAMPP Control Panel or Services.'
                    : ' Check DB_HOST / DB_PORT / DB_NAME in api/config.php.');
            
            // Fall back to mock database on connection failure
            require_once __DIR__ . '/MockDatabase.php';
            $pdo = new MockPDO(__DIR__ . '/../data/mock_db.json');
            return $pdo;
        }
    }
    return $pdo;
}

/* —— PHP session configuration (must run before headers) ——— */
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_samesite', 'Lax');  // allows same-site Ajax
    // Remove 'secure' flag if not running on HTTPS locally:
    // ini_set('session.cookie_secure', '1');
    session_name('NEXUSIT_SESSION');
    session_start();
}

/* —— CORS + JSON headers ——————————————————————————————————— */
header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if ($origin !== '*') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

/* —— Security headers ——————————————————————————————— */
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* —— Helpers ———————————————————————————————————————————————— */
function json_ok($data = [], int $code = 200): void
{
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function json_err(string $msg, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

function method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD']);
}
