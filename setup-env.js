#!/usr/bin/env node

// Setup script for environment variables
const fs = require('fs');
const path = require('path');

const envContent = `# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=contest_platform

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Email Configuration (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=

# Social Media API Keys (optional)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TWITTER_API_KEY=
TWITTER_API_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=`;

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with default configuration');
  console.log('📝 Please update the database credentials and JWT secret as needed');
} else {
  console.log('⚠️  .env file already exists');
}

console.log('\n🚀 To start the server with proper environment variables:');
console.log('   npm run dev');
console.log('\n📋 Environment variables set:');
console.log('   - JWT_SECRET: your-super-secret-jwt-key-change-this-in-production');
console.log('   - DB_HOST: localhost');
console.log('   - DB_PORT: 3306');
console.log('   - DB_USER: root');
console.log('   - DB_PASSWORD: password');
console.log('   - DB_NAME: contest_platform');
