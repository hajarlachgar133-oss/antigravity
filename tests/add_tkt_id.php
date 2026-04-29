<?php
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=nexusit_db', 'root', '');
try {
    $pdo->exec('ALTER TABLE requests ADD COLUMN ticket_id INT UNSIGNED DEFAULT NULL AFTER id');
    echo 'Added ticket_id';
} catch (Exception $e) {}
try {
    $pdo->exec('ALTER TABLE requests ADD CONSTRAINT fk_req_tkt FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE');
    echo 'Added fk';
} catch (Exception $e) {}
