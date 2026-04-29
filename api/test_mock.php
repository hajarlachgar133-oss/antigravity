<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$json = '{"email":"admin@nexusit.com","password":"test"}';
file_put_contents('php://memory', $json);
// We can't mock php://input easily without runkit, so we just override it in the config body() function, or since body() uses file_get_contents('php://input'), we can't easily mock it.
// Hmm, what if we use the builtin web server to test it?
