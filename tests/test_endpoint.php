<?php
// PHP test endpoint to confirm API functionality
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => true,
    'message' => 'API Endpoint is reachable and functioning correctly.',
    'env'     => 'XAMPP',
    'time'    => date('c')
]);
