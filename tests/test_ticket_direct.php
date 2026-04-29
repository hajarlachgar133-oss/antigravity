<?php
/* Direct test — simulates what user_tickets.php POST does */
require_once __DIR__ . '/api/config.php';

// Fake a logged-in employee (use real user id=5)
$userId   = 5;
$subject  = 'TEST Complaint ' . date('His');
$type     = 'Complaint';
$dept     = 'IT Département';
$details  = 'Test complaint details';
$priority = 'medium';
$device   = '';

$errors = [];

// 1 — Generate ref
try {
    $maxId  = (int)db()->query('SELECT IFNULL(MAX(id),0) FROM tickets')->fetchColumn();
    $nextId = $maxId + 1;
    $tktRef = 'TKT-' . date('Y') . str_pad($nextId, 4, '0', STR_PAD_LEFT);
    while ((int)db()->query("SELECT COUNT(*) FROM tickets WHERE ticket_ref = '$tktRef'")->fetchColumn() > 0) {
        $nextId++;
        $tktRef = 'TKT-' . date('Y') . str_pad($nextId, 4, '0', STR_PAD_LEFT);
    }
    echo "✅ ticket_ref generated: $tktRef\n";
} catch (Throwable $e) { echo "❌ ticket_ref: " . $e->getMessage() . "\n"; exit; }

// 2 — Insert ticket
try {
    $ins = db()->prepare(
        'INSERT INTO tickets (ticket_ref, submitted_by, subject, description, category, priority, status, device_id)
         VALUES (?, ?, ?, ?, ?, ?, "open", NULL)'
    );
    $ins->execute([$tktRef, $userId, $subject, $details, $type, $priority]);
    $newId = db()->lastInsertId();
    echo "✅ tickets INSERT ok — id=$newId\n";
} catch (Throwable $e) { echo "❌ tickets INSERT: " . $e->getMessage() . "\n"; exit; }

// 3 — Get user info
try {
    $uStmt = db()->prepare('SELECT email, department, full_name FROM users WHERE id = ? LIMIT 1');
    $uStmt->execute([$userId]);
    $uRow     = $uStmt->fetch();
    $uEmail   = $uRow['email']      ?? '';
    $uDept    = $uRow['department'] ?? $dept;
    $fullName = $uRow['full_name']  ?? 'Employee';
    echo "✅ user fetched: $fullName <$uEmail> dept=$uDept\n";
} catch (Throwable $e) { echo "❌ user fetch: " . $e->getMessage() . "\n"; }

// 4 — Insert into requests (with ticket_id)
try {
    db()->prepare(
        'INSERT INTO requests
            (ticket_id, submitted_by, full_name, email, request_type, department, subject, details, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$newId, $userId, $fullName, $uEmail, 'Complaint', $uDept,
                "[$priority] $subject", $details, $priority]);
    echo "✅ requests INSERT ok (with ticket_id)\n";
} catch (Throwable $e) {
    echo "❌ requests INSERT (with ticket_id): " . $e->getMessage() . "\n";

    // Fallback without ticket_id
    try {
        db()->prepare(
            'INSERT INTO requests
                (submitted_by, full_name, email, request_type, department, subject, details, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$userId, $fullName, $uEmail, 'Complaint', $uDept,
                    "[$priority] $subject", $details, $priority]);
        echo "✅ requests INSERT ok (WITHOUT ticket_id fallback)\n";
    } catch (Throwable $e2) {
        echo "❌ requests INSERT fallback: " . $e2->getMessage() . "\n";
    }
}

// Show what's now in DB
echo "\n--- tickets ---\n";
foreach (db()->query("SELECT id, ticket_ref, category, status FROM tickets ORDER BY id DESC LIMIT 3")->fetchAll() as $r)
    echo "  id={$r['id']} ref={$r['ticket_ref']} cat={$r['category']} status={$r['status']}\n";

echo "\n--- requests ---\n";
foreach (db()->query("SELECT id, ticket_id, request_type, subject FROM requests ORDER BY id DESC LIMIT 3")->fetchAll() as $r)
    echo "  id={$r['id']} ticket_id={$r['ticket_id']} type={$r['request_type']} subj={$r['subject']}\n";
