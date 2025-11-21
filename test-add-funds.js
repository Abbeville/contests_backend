#!/usr/bin/env node

// Test script to verify add funds works with the new approach
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001/api';

async function testAddFunds() {
  try {
    console.log('🧪 Testing add funds with database user validation...');
    
    // Test login first
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
      return;
    }
    
    const token = loginData.data.token;
    console.log('✅ Login successful');
    
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
      console.log('✅ Add funds successful!');
      console.log('💰 Transaction ID:', addFundsData.data.transaction.id);
      console.log('💰 New balance:', addFundsData.data.wallet.balance);
    } else {
      console.log('❌ Add funds failed:', addFundsData.message);
    }
    
    // Test wallet access
    const walletResponse = await fetch(`${API_BASE_URL}/wallets`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    const walletData = await walletResponse.json();
    
    if (walletData.success) {
      console.log('✅ Wallet access successful');
      console.log('💰 Current balance:', walletData.data.wallet.balance);
    } else {
      console.log('❌ Wallet access failed:', walletData.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAddFunds();
