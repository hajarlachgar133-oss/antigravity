<?php
/**
 * MockDatabase — Development fallback when MySQL is unavailable
 * Uses JSON file storage for rapid prototyping/testing
 */

class MockPDO {
    private $dataFile;
    private $data = [];
    private $attributes = [];

    public function __construct($dataFile = null) {
        $this->dataFile = $dataFile ?? __DIR__ . '/../data/mock_db.json';
        $this->loadData();
    }

    private function loadData() {
        if (file_exists($this->dataFile)) {
            $json = file_get_contents($this->dataFile);
            $this->data = json_decode($json, true) ?? [];
        } else {
            $this->data = $this->getDefaultData();
            $this->saveData();
        }
    }

    private function saveData() {
        @mkdir(dirname($this->dataFile), 0755, true);
        file_put_contents($this->dataFile, json_encode($this->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    private function getDefaultData() {
        return [
            'users' => [
                [
                    'id' => 1,
                    'full_name' => 'Admin User',
                    'email' => 'admin@nexusit.com',
                    'password_hash' => '$2y$10$D7VXXA4WQgAT8MdUFV9Vg.XTsQxH7CKpc6jhY16xeIvy5FYbfrjJ.', // admin123
                    'role' => 'admin',
                    'department' => 'IT Department',
                    'avatar_initials' => 'AU',
                    'is_active' => 1,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ],
                [
                    'id' => 2,
                    'full_name' => 'Test Employee',
                    'email' => 'employee@nexusit.com',
                    'password_hash' => '$2y$10$D7VXXA4WQgAT8MdUFV9Vg.XTsQxH7CKpc6jhY16xeIvy5FYbfrjJ.', // admin123
                    'role' => 'employee',
                    'department' => 'Support',
                    'avatar_initials' => 'TE',
                    'is_active' => 1,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]
            ],
            'tickets' => [],
            'inventory' => [],
            'activity_log' => []
        ];
    }

    public function prepare($query) {
        return new MockPDOStatement($this, $query, $this->data);
    }

    public function setAttribute($attr, $value) {
        $this->attributes[$attr] = $value;
    }

    public function &getData() {
        return $this->data;
    }

    public function saveDatabase() {
        $this->saveData();
    }
    
    public function lastInsertId() {
        return 0;
    }
}

class MockPDOStatement {
    private $pdo;
    private $query;
    private $data;
    private $result = null;
    private $position = 0;

    public function __construct(&$pdo, $query, &$data) {
        $this->pdo = &$pdo;
        $this->query = $query;
        $this->data = &$data;
    }

    public function execute($params = []) {
        // Simple mock implementation - parse common queries
        $query_lower = strtolower($this->query);
        
        if (strpos($query_lower, 'select') === 0) {
            if (strpos($query_lower, 'from users') !== false) {
                if (strpos($query_lower, 'where email') !== false) {
                    // Extract email from params
                    $email = $params[0] ?? null;
                    $results = array_filter($this->data['users'], function($user) use ($email) {
                        return $user['email'] === $email && $user['is_active'] == 1;
                    });
                    $this->result = array_values($results);
                } elseif (strpos($query_lower, 'where id') !== false) {
                    $id = $params[0] ?? null;
                    $results = array_filter($this->data['users'], function($user) use ($id) {
                        return $user['id'] == $id && $user['is_active'] == 1;
                    });
                    $this->result = array_values($results);
                } else {
                    $this->result = array_filter($this->data['users'], function($user) {
                        return $user['is_active'] == 1;
                    });
                }
            } elseif (strpos($query_lower, 'from tickets') !== false) {
                $this->result = $this->data['tickets'] ?? [];
            } elseif (strpos($query_lower, 'from inventory') !== false) {
                $this->result = $this->data['inventory'] ?? [];
            } elseif (strpos($query_lower, 'from activity_log') !== false) {
                $this->result = $this->data['activity_log'] ?? [];
            } else {
                $this->result = [];
            }
            $this->result = array_values($this->result); // Re-index array
        } elseif (strpos($query_lower, 'insert') === 0) {
            // Mock insert
            return true;
        } elseif (strpos($query_lower, 'update') === 0) {
            return true;
        } elseif (strpos($query_lower, 'delete') === 0) {
            return true;
        }
        
        $this->position = 0;
        return true;
    }

    public function fetch($mode = null) {
        if ($this->result === null || $this->position >= count($this->result)) {
            return false;
        }
        $row = $this->result[$this->position++];
        // Convert values to appropriate types
        if (is_array($row)) {
            foreach ($row as &$value) {
                if ($value === 'true') $value = true;
                elseif ($value === 'false') $value = false;
                elseif ($value === 'null') $value = null;
                elseif (is_numeric($value)) $value = (int)$value;
            }
        }
        return $row;
    }

    public function fetchAll($mode = null) {
        $all = [];
        while (($row = $this->fetch($mode)) !== false) {
            $all[] = $row;
        }
        return $all;
    }

    public function rowCount() {
        return count($this->result ?? []);
    }
}

