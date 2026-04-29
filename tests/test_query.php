<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
$stmt = $pdo->query('SELECT id, full_name, request_type, status FROM requests');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
