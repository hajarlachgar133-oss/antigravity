<?php
/* ============================================================
   NEXUSIT — Dashboard KPIs + Activity Feed API
   GET /api/dashboard.php              → KPI counts + recent activity
   GET /api/dashboard.php?action=activity → activity feed only
   ============================================================ */
require_once __DIR__ . '/config.php';
if (empty($_SESSION['user_id'])) json_err('Not authenticated.', 401);

$action = $_GET['action'] ?? '';
session_write_close(); // GET-only endpoint — release session lock immediately

/* —— ACTIVITY FEED ONLY ——————————————————————————————————— */
if ($action === 'activity') {
    $stmt = db()->query(
        'SELECT a.*, u.full_name AS actor_name, u.avatar_initials
         FROM activity_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC LIMIT 20'
    );
    json_ok($stmt->fetchAll());
}

/* —— FULL DASHBOARD KPIs ————————————————————————————————— */
// Use view for KPIs — if view missing fall back to manual counts
try {
    $kpi = db()->query('SELECT * FROM vw_dashboard_kpis LIMIT 1')->fetch();
} catch (\Throwable $e) {
    // Fallback if view doesn't exist yet
    $kpi = [
        'total_assets'    => db()->query('SELECT COUNT(*) FROM inventory')->fetchColumn(),
        'active_assets'   => db()->query("SELECT COUNT(*) FROM inventory WHERE status='active'")->fetchColumn(),
        'open_tickets'    => db()->query("SELECT COUNT(*) FROM tickets WHERE status IN ('open','in_progress')")->fetchColumn(),
        'critical_issues' => db()->query("SELECT COUNT(*) FROM issues WHERE status='critical'")->fetchColumn(),
    ];
}

// Inventory breakdown by type for donut chart
$typeCounts = db()->query(
    'SELECT asset_type AS type, COUNT(*) AS count FROM inventory GROUP BY asset_type ORDER BY count DESC'
)->fetchAll();

// Recent activity (last 8 entries)
$activity = db()->query(
    "SELECT a.action_type, a.description, a.entity_type, a.created_at,
            u.full_name AS actor_name, u.avatar_initials
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 8"
)->fetchAll();

// Map action types to icons / colour classes
$iconMap = [
    'asset_added'       => ['icon' => 'fa-server',              'cls' => 'ai-blue'],
    'asset_updated'     => ['icon' => 'fa-pen',                 'cls' => 'ai-blue'],
    'asset_deleted'     => ['icon' => 'fa-trash',               'cls' => 'ai-red'],
    'issue_created'     => ['icon' => 'fa-triangle-exclamation','cls' => 'ai-red'],
    'ticket_created'    => ['icon' => 'fa-ticket',              'cls' => 'ai-purple'],
    'request_submitted' => ['icon' => 'fa-comment-dots',        'cls' => 'ai-purple'],
    'user_login'        => ['icon' => 'fa-right-to-bracket',    'cls' => 'ai-green'],
    'user_registered'   => ['icon' => 'fa-user-plus',           'cls' => 'ai-purple'],
    'user_logout'       => ['icon' => 'fa-right-from-bracket',  'cls' => 'ai-green'],
];

foreach ($activity as &$a) {
    $map       = $iconMap[$a['action_type']] ?? ['icon' => 'fa-bolt', 'cls' => 'ai-blue'];
    $a['icon'] = $map['icon'];
    $a['cls']  = $map['cls'];

    // Human-readable relative time
    $diff = max(0, time() - strtotime($a['created_at']));
    if      ($diff < 60)     $a['time'] = $diff . 's ago';
    elseif  ($diff < 3600)   $a['time'] = floor($diff / 60)    . 'm ago';
    elseif  ($diff < 86400)  $a['time'] = floor($diff / 3600)  . 'h ago';
    else                     $a['time'] = floor($diff / 86400) . 'd ago';
}
unset($a);

json_ok([
    'kpi'       => $kpi,
    'typeChart' => $typeCounts,
    'activity'  => $activity,
]);
