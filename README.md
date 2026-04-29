# NexusIT — Setup Guide

## Requirements
- **PHP** 7.4+ (8.x recommended)
- **MySQL** 5.7+ or MariaDB 10.3+
- **Apache** with mod_rewrite enabled (XAMPP / WAMP / LAMP)

---

## Step 1 — Import the Database

Open your MySQL client (HeidiSQL, DBeaver, or phpMyAdmin) and run:

```sql
source database/nexusit_db.sql
```

Or from the command line:
```bash
mysql -u root -p < database/nexusit_db.sql
```

This will create the `nexusit_db` database with all tables, seed data, views, trigger, and the default admin account.

---

## Step 2 — Configure the Database Connection

Edit **`api/config.php`** and set your credentials:

```php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3307');
define('DB_NAME', 'nexusit_db');
define('DB_USER', 'root');       // ← your MySQL username
define('DB_PASS', '');           // ← your MySQL password
```

---

## Step 3 — Serve with Apache

Place the entire `ocp/` folder inside your web server root, for example:

- **XAMPP** → `C:\xampp\htdocs\ocp\`
- **WAMP**  → `C:\wamp64\www\ocp\`

Then visit: `http://localhost/ocp/`

---

## Default Admin Login
| Field    | Value               |
|----------|---------------------|
| Email    | admin@nexusit.com   |    
| Password | admin123            |

> ⚠️ **Change the password immediately** after first login in Settings.
---

## API Endpoints
   
| Module        | File                      | Methods              |
|---------------|---------------------------|----------------------|
| Auth          | `api/auth.php`            | GET, POST, PUT       |
| Inventory     | `api/inventory.php`       | GET, POST, PUT, DELETE |
| Issues        | `api/tickets.php`         | GET, POST, PUT, DELETE |
| Requests      | `api/requests.php`        | GET, POST, PUT, DELETE |
| Documentation | `api/docs.php`            | GET, POST, PUT, DELETE |
| User Tickets  | `api/user_tickets.php`    | GET, POST, PUT       |
| Dashboard     | `api/dashboard.php`       | GET                  |
| Settings      | `api/settings.php`        | GET, PUT, POST       |

---

## File Structure

```
ocp/
├── index.html              ← Single-page app shell
├── api/
│   ├── config.php          ← DB connection (edit credentials here)
│   ├── auth.php
│   ├── inventory.php
│   ├── tickets.php
│   ├── requests.php
│   ├── docs.php
│   ├── dashboard.php
│   ├── user_tickets.php
│   ├── settings.php
│   └── .htaccess
├── database/
│   └── nexusit_db.sql      ← Full schema + seed data
└── assets/
    ├── css/style.css
    └── js/
        ├── api.js           ← HTTP client (new)
        ├── data.js
        ├── auth.js
        ├── dashboard.js
        ├── inventory.js
        ├── troubleshoot.js
        ├── requests.js
        ├── docs.js
        ├── settings.js
        ├── chatbot.js
        ├── ipchecker.js
        ├── nav.js
        └── utils.js
```
