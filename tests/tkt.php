<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
$stmt = $pdo->prepare("INSERT INTO tickets (ticket_ref, submitted_by, subject, description, category, priority, status) VALUES ('TKT-20260002', 1, 'Application Latency Issues', 'The web application is experiencing heavy latency during peak hours.', 'Complaint', 'high', 'open')");
try { $stmt->execute(); } catch (Exception $e) {}
$tktId = $pdo->lastInsertId();
$pdo->query("UPDATE requests SET ticket_id = $tktId WHERE id = 1");
echo 'Ticket added.';
