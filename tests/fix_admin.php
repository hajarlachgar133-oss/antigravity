<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
$hash = password_hash('password123', PASSWORD_BCRYPT);
$pdo->query("UPDATE users SET password_hash = '$hash' WHERE email = 'admin@nexusit.com'");
echo "Admin password fixed to password123";
