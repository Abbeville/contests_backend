# Database Migrations

This document explains how to run database migrations for the Contest Platform backend.

## Prerequisites

1. **MySQL Database**: Make sure MySQL is installed and running
2. **Database Created**: Create the database `contests` (or your preferred name)
3. **Environment Variables**: Set up your `.env` file with database credentials

## Environment Setup

Create a `.env` file in the `backend-express` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=contests

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

## Running Migrations

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Initial Migration
```bash
npm run migration:run
```

This will create all the necessary tables:
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

### 3. Check Migration Status
```bash
npm run migration:show
```

### 4. Revert Migration (if needed)
```bash
npm run migration:revert
```

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migration:run` | Run all pending migrations |
| `npm run migration:revert` | Revert the last migration |
| `npm run migration:show` | Show migration status |
| `npm run migration:generate` | Generate a new migration |

## Database Schema Overview

### Users Table
- Primary user accounts (creators and brands)
- Authentication and basic user information
- User type differentiation (creator/brand)

### User Profiles Table
- Extended profile information
- Optional fields for detailed user data
- One-to-one relationship with users

### Contests Table
- Contest creation and management
- Prize amounts and platform specifications
- Status tracking and participant limits

### Contest Participants Table
- Many-to-many relationship between users and contests
- Participation status tracking
- Join timestamps

### Contest Submissions Table
- User submissions for contests
- Post URLs and media content
- Approval workflow and prize allocation

### Wallets Table
- User financial accounts
- Balance tracking and currency support
- One-to-one relationship with users

### Transactions Table
- Financial transaction history
- Multiple transaction types (deposits, withdrawals, prizes)
- Status tracking and metadata

### Social Media Accounts Table
- Connected social media platforms
- Access tokens and follower counts
- Platform-specific data

### Support System Tables
- Support tickets and messages
- Priority and status management
- Attachment support

### Notifications Table
- User notifications and alerts
- Targeted messaging capabilities
- Read status tracking

## Troubleshooting

### Migration Fails
1. Check database connection settings in `.env`
2. Ensure MySQL is running
3. Verify database exists
4. Check user permissions

### Permission Errors
```sql
-- Grant necessary permissions
GRANT ALL PRIVILEGES ON contests.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Connection Issues
```bash
# Test MySQL connection
mysql -u root -p -h localhost

# Check if database exists
SHOW DATABASES;
```

## Development vs Production

- **Development**: Use `synchronize: true` for automatic schema updates
- **Production**: Use migrations only, never synchronize
- **Migrations**: Always test migrations in development first

## Next Steps

After running migrations:

1. **Start the server**: `npm run dev`
2. **Test endpoints**: Verify all API endpoints work
3. **Create test data**: Add sample users and contests
4. **Frontend integration**: Connect frontend to backend

## Security Notes

- Never commit `.env` files to version control
- Use strong passwords for database users
- Limit database user permissions in production
- Regularly backup your database
