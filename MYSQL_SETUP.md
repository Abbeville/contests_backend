# MySQL Database Setup

## Environment Variables

Create a `.env` file in the `backend-express` directory with the following MySQL configuration:

```env
# Database Configuration (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=contest_platform

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads

# Email Configuration (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@contestplatform.com

# Social Media API Keys (optional)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```

## MySQL Installation & Setup

### 1. Install MySQL
- **Windows**: Download from [MySQL Official Website](https://dev.mysql.com/downloads/mysql/)
- **macOS**: `brew install mysql`
- **Linux**: `sudo apt-get install mysql-server` (Ubuntu/Debian) or `sudo yum install mysql-server` (CentOS/RHEL)

### 2. Start MySQL Service
```bash
# Windows (if installed as service)
net start mysql

# macOS
brew services start mysql

# Linux
sudo systemctl start mysql
```

### 3. Create Database
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE contest_platform;

-- Create user (optional, for better security)
CREATE USER 'contest_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON contest_platform.* TO 'contest_user'@'localhost';
FLUSH PRIVILEGES;
```

### 4. Install Dependencies
```bash
cd backend-express
npm install
```

### 5. Run the Server
```bash
# Development mode with database
npm run dev

# Or simple mode without database (for testing)
npm run dev:simple
```

## Database Schema

The application will automatically create the following tables when you run it:

- `users` - User accounts (creators and brands)
- `user_profiles` - Extended user profile information
- `contests` - Contest information
- `contest_participants` - Contest participation records
- `contest_submissions` - Contest entries/submissions
- `wallets` - User wallet information
- `transactions` - Financial transactions
- `social_media_accounts` - Connected social media accounts
- `support_tickets` - Customer support tickets
- `support_messages` - Support ticket messages
- `notifications` - User notifications

## Troubleshooting

### Authentication Protocol Error
If you get `ER_NOT_SUPPORTED_AUTH_MODE` error:
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Change authentication method for root user
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

### Connection Issues
1. Make sure MySQL is running: `sudo systemctl status mysql`
2. Check your credentials in the `.env` file
3. Verify the database exists: `SHOW DATABASES;`
4. Check MySQL error logs for specific issues

### Permission Issues
1. Make sure your MySQL user has proper privileges
2. Try connecting manually: `mysql -u root -p -h localhost`

### Port Issues
1. Default MySQL port is 3306
2. Check if port is in use: `netstat -an | grep 3306`
3. Update port in `.env` if using non-standard port

### Test Connection
Run the test script to verify your MySQL setup:
```bash
node test-mysql.js
```

## Migration Notes

The migration has been updated to use `varchar` instead of `enum` for better MySQL compatibility:

- **User Types**: `creator`, `brand`, `admin` stored as varchar(20)
- **Transaction Types**: `deposit`, `withdrawal`, `contest_prize`, etc. stored as varchar(50)
- **Status Fields**: `pending`, `completed`, `failed`, etc. stored as varchar(20)
- **Platform Types**: `instagram`, `tiktok`, `twitter`, etc. stored as varchar(20)

This ensures compatibility across different MySQL versions and avoids enum-related issues.
