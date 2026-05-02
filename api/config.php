<?php
/* ============================================================
   NEXUSIT — Database Configuration
   ============================================================ */

/* —— Production error reporting ———————————————————————————
   On InfinityFree (production), hide errors from users
   but log them for debugging. Enable display_errors only
   if you're testing locally.
   ─────────────────────────────────────────────────────────── */
$isDevelopment = (strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false);

error_reporting(E_ALL);
ini_set('display_errors', $isDevelopment ? '1' : '0');  // Hide in production
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');

// Ensure logs directory exists
if (!is_dir(__DIR__ . '/../logs')) {
    @mkdir(__DIR__ . '/../logs', 0755, true);
}

/* —— Output buffering ————————————————————————————————————
   Catches any accidental echo / whitespace before headers.
   Flushed naturally when the script exits.
   ─────────────────────────────────────────────────────────── */
ob_start();

/* ════════════════════════════════════════════════════════════
   INFINITYFREE DATABASE CREDENTIALS
   ════════════════════════════════════════════════════════════ */
define('DB_HOST', 'sql113.infinityfree.com');      // InfinityFree host
define('DB_PORT', '3306');                          // Standard MySQL port
define('DB_NAME', 'if0_41811986_nexus');            // Database name with if0_ prefix
define('DB_USER', 'if0_41811986_user');             // InfinityFree username
define('DB_PASS', 'your_hosting_password_here');    // Your hosting password
define('DB_CHARSET', 'utf8mb4');                    // UTF-8 with emoji support

// UPDATE ABOVE WITH YOUR ACTUAL INFINITYFREE CREDENTIALS!

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
 * Database connection singleton - PDO with InfinityFree
 */
function db(): PDO {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            // Proper DSN format for MySQL
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                DB_HOST,
                DB_PORT,
                DB_NAME,
                DB_CHARSET
            );
            
            // Create PDO connection with proper options
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            
            // Verify connection works
            $pdo->query('SELECT 1');
            
        } catch (PDOException $e) {
            http_response_code(503);
            
            // Detailed error messages for debugging
            $errorCode = $e->getCode();
            $errorMsg = $e->getMessage();
            
            // Determine the issue
            if (strpos($errorMsg, '1045') !== false || strpos($errorMsg, 'Access denied') !== false) {
                $hint = 'Database authentication failed. Check DB_USER and DB_PASS in config.php';
            } elseif (strpos($errorMsg, '1049') !== false || strpos($errorMsg, 'Unknown database') !== false) {
                $hint = 'Database does not exist. Check DB_NAME in config.php';
            } elseif (strpos($errorMsg, '2002') !== false || strpos($errorMsg, 'Connection refused') !== false) {
                $hint = 'Cannot connect to database host. Check DB_HOST and DB_PORT';
            } else {
                $hint = $errorMsg;
            }
            
            // Log error and return JSON response
            error_log('[Database Connection Error] ' . $hint);
            
            echo json_encode([
                'success' => false,
                'error' => 'Database connection failed',
                'message' => $hint,
                'code' => $errorCode
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            
            exit(1);
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

/* —— CORS + Security Headers ——————————————————————————————
   Allows API calls from frontend and prevents common attacks
   ─────────────────────────────────────────────────────────── */

// Determine the origin (frontend domain)
$allowedOrigins = [
    'http://localhost:8000',
    'http://localhost:3000',
    'https://your-domain.com',  // Update this!
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Check if origin is allowed
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
} else if ($origin === '') {
    // Same-origin request
    header('Access-Control-Allow-Origin: *');
} else {
    // For development/testing, allow any origin
    // REMOVE THIS IN PRODUCTION
    header('Access-Control-Allow-Origin: *');
}

// Set Content-Type and allowed methods
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 3600');

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
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
