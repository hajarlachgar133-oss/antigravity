<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
$stmt = $pdo->query('SELECT id, email, password_hash, role FROM users');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
