#!/usr/bin/env node

// Test script to verify wallet creation works
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001/api';

async function testWalletCreation() {
  try {
    console.log('🧪 Testing wallet creation...');
    
    // Test login (this should work if user exists)
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.success) {
      console.log('❌ Login failed:', loginData.message);
      console.log('💡 Please create a test user first or use existing credentials');
      return;
    }
    
    const token = loginData.data.token;
    console.log('✅ Login successful');
    
    // Test wallet access (should create wallet if doesn't exist)
    const walletResponse = await fetch(`${API_BASE_URL}/wallets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    const walletData = await walletResponse.json();
    
    if (walletData.success) {
      console.log('✅ Wallet access successful');
      console.log('💰 Wallet balance:', walletData.data.wallet.balance);
    } else {
      console.log('❌ Wallet access failed:', walletData.message);
    }
    
    // Test add funds
    const addFundsResponse = await fetch(`${API_BASE_URL}/wallets/add-funds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 100,
        description: 'Test deposit'
      })
    });
    
    const addFundsData = await addFundsResponse.json();
    
    if (addFundsData.success) {
      console.log('✅ Add funds successful');
      console.log('💰 Transaction ID:', addFundsData.data.transaction.id);
    } else {
      console.log('❌ Add funds failed:', addFundsData.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWalletCreation();
