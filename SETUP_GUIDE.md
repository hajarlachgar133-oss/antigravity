# NexusIT Setup Guide - Development Mode

## Quick Start (Without MySQL)

The application now includes an **automatic fallback to mock database** when MySQL is unavailable. No configuration needed!

### Test Login Credentials

The mock database includes sample users:

**Admin Account:**
- Email: `admin@nexusit.com`
- Password: `admin123`
- Role: Admin

**Employee Account:**
- Email: `employee@nexusit.com`
- Password: `admin123`
- Role: Employee

## How It Works

1. **Automatic Detection** - The app checks if MySQL is running on startup
2. **Fallback to Mock DB** - If unavailable, uses JSON file storage instead
3. **Full Functionality** - All features work in development mode
4. **Easy Migration** - Switch to real MySQL anytime by updating config

## Architecture

```
config.php (detects MySQL availability)
    ↓
MySQL Available? 
    ├─ Yes → Use PDO with MySQL
    └─ No → Use MockPDO (JSON storage)

api/MockDatabase.php
    ├─ MockPDO class (PDO-compatible)
    └─ MockPDOStatement class (mimics PDO behavior)

data/mock_db.json
    └─ Development data storage
```

## Folder Structure

```
ocp/
├── api/
│   ├── config.php          (Database configuration + fallback logic)
│   ├── MockDatabase.php    (Mock PDO implementation)
│   ├── auth.php            (Authentication)
│   └── ... other endpoints
├── data/
│   ├── mock_db.json        (Development database file)
│   ├── .htaccess          (Protect from web access)
│   └── .gitignore         (Keep data/ out of git)
└── ... rest of application
```

## Setting Up Real MySQL (Optional)

If you want to use a real MySQL database:

### 1. Ensure MySQL is Running
```powershell
# Windows - Start MySQL80 service
Start-Service MySQL80

# Or from Services (services.msc)
```

### 2. Create Database
```bash
mysql -u root -p
```

```sql
CREATE DATABASE IF NOT EXISTS nexusit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nexusit_db;
-- Then import the schema from: database/nexusit_db.sql
```

### 3. Update Configuration
Edit `api/config.php`:

```php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');        // Default MySQL port
define('DB_NAME', 'nexusit_db');
define('DB_USER', 'root');
define('DB_PASS', 'your_password');  // ← SET YOUR PASSWORD
```

### 4. Test Connection
Open in browser: `http://localhost/ocp/api/test.php`

## Customizing Mock Data

Edit `data/mock_db.json` to add/modify test users:

```json
{
  "users": [
    {
      "id": 3,
      "full_name": "New User",
      "email": "user@example.com",
      "password_hash": "$2y$10$D7VXXA4WQgAT8MdUFV9Vg.XTsQxH7CKpc6jhY16xeIvy5FYbfrjJ.",
      "role": "employee",
      "is_active": 1
    }
  ]
}
```

**Password Hash Reference:**
- `admin123` = `$2y$10$D7VXXA4WQgAT8MdUFV9Vg.XTsQxH7CKpc6jhY16xeIvy5FYbfrjJ.`

To generate new password hashes:
```php
echo password_hash('your_password', PASSWORD_BCRYPT);
```

## Troubleshooting

**Login fails:**
- Check email matches exactly in mock_db.json
- Verify password hash is correct
- Check `is_active` flag is 1

**MySQL connection error:**
- App will automatically use MockPDO
- Check `data/mock_db.json` exists
- Ensure `data/` directory is writable

**Want real MySQL again:**
- Install and start MySQL service
- Update `api/config.php` with credentials
- App will automatically switch to MySQL

## Security Notes

⚠️ **For Development Only:**
- Mock database is not persistent between installations
- JSON file is human-readable
- Use real MySQL for production
- Change default admin password in production

## Files Modified

- ✅ `api/config.php` - Added fallback logic
- ✅ `api/MockDatabase.php` - New mock implementation
- ✅ `data/mock_db.json` - New mock data file
- ✅ `data/.htaccess` - Protect data directory
- ✅ `data/.gitignore` - Exclude data files from git

## Next Steps

1. **Test Login** - Open `index.html` and try the credentials above
2. **Add More Data** - Edit `data/mock_db.json` to add test records
3. **Switch to MySQL** - When ready, configure MySQL and update config.php
4. **Deploy** - For production, use a real database and remove mock features
