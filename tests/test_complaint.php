<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
$stmt = $pdo->prepare("INSERT INTO requests (submitted_by, full_name, email, request_type, department, subject, details, status, priority) VALUES (1, 'Admin User', 'admin@nexusit.com', 'Complaint', 'IT Department', 'Application Latency Issues', 'The web application is experiencing heavy latency during peak hours.', 'pending', 'high')");
$stmt->execute();
echo 'Complaint created.';
