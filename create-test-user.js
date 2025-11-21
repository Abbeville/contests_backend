#!/usr/bin/env node

// Script to create a test user
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    console.log('👤 Creating test user...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'contests'
    });

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    // Create user
    const [userResult] = await connection.execute(
      'INSERT INTO users (id, email, username, password, user_type, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'f1bb9386-1a06-443c-a175-f371a76084cf', // Use the same ID from the JWT token
        'test@example.com',
        'testuser',
        hashedPassword,
        'brand',
        1, // is_verified
        1  // is_active
      ]
    );

    console.log('✅ User created:', userResult.insertId);

    // Create user profile
    await connection.execute(
      'INSERT INTO user_profiles (id, user_id, first_name, last_name) VALUES (?, ?, ?, ?)',
      [
        'profile-' + Date.now(),
        'f1bb9386-1a06-443c-a175-f371a76084cf',
        'Test',
        'User'
      ]
    );

    console.log('✅ User profile created');

    // Create wallet
    await connection.execute(
      'INSERT INTO wallets (id, user_id, balance, currency, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        'wallet-' + Date.now(),
        'f1bb9386-1a06-443c-a175-f371a76084cf',
        0,
        'USD',
        1
      ]
    );

    console.log('✅ Wallet created');

    await connection.end();
    
    console.log('\n🎉 Test user created successfully!');
    console.log('📧 Email: test@example.com');
    console.log('🔑 Password: password123');
    console.log('🆔 User ID: f1bb9386-1a06-443c-a175-f371a76084cf');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
  }
}

createTestUser();
