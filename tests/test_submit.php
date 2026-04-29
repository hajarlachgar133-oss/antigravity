<?php
$_SESSION['user_id'] = 5; 
$_SESSION['user_role'] = 'employee'; 
$_SERVER['REQUEST_METHOD'] = 'POST'; 
$_POST = [
    'name'=>'Hiba', 
    'email'=>'hibalachgar123@gmail.com', 
    'dept'=>'IT', 
    'type'=>'Incident', 
    'subject'=>'Network Down', 
    'details'=>'Cannot connect', 
    'priority'=>'high', 
    'device'=>''
]; 
require 'c:/Users/HP/Desktop/ocp/api/user_tickets.php';
