import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Contest Platform Backend is running!'
  });
});

// Mock API endpoints for testing
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API is working!',
    data: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

// Mock authentication endpoints
app.post('/api/auth/register', (req, res) => {
  res.json({
    success: true,
    message: 'Mock registration endpoint - database not connected',
    data: {
      user: {
        id: 'mock-user-id',
        email: req.body.email,
        username: req.body.username,
        user_type: req.body.user_type || 'creator'
      },
      token: 'mock-jwt-token'
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Mock login endpoint - database not connected',
    data: {
      user: {
        id: 'mock-user-id',
        email: req.body.email,
        username: 'mockuser',
        user_type: 'creator'
      },
      token: 'mock-jwt-token'
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    message: 'Mock user profile endpoint - database not connected',
    data: {
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        username: 'mockuser',
        user_type: 'creator',
        is_verified: true,
        is_active: true
      }
    }
  });
});

// Mock contest endpoints
app.get('/api/contests', (req, res) => {
  res.json({
    success: true,
    data: {
      contests: [
        {
          id: 'mock-contest-1',
          title: 'Sample Photo Contest',
          description: 'A mock photo contest for testing',
          status: 'active',
          total_prize: 1000,
          platform: 'instagram',
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          entries_count: 15,
          brand_name: 'Sample Brand',
          hashtags: ['#contest', '#photo', '#win'],
          is_boosted: false,
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-contest-2',
          title: 'Creative Video Challenge',
          description: 'Show your creativity in this video contest',
          status: 'active',
          total_prize: 2500,
          platform: 'tiktok',
          end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          entries_count: 8,
          brand_name: 'Creative Co',
          hashtags: ['#video', '#creative', '#challenge'],
          is_boosted: true,
          created_at: new Date().toISOString()
        }
      ]
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    }
  });
});

// Mock wallet endpoints
app.get('/api/wallets', (req, res) => {
  res.json({
    success: true,
    data: {
      wallet: {
        id: 'mock-wallet-1',
        user_id: 'mock-user-id',
        balance: 75000.00,
        pending_balance: 0,
        total_deposited: 100000.00,
        total_earned: 75000.00,
        currency: 'NGN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  });
});

app.get('/api/wallets/transactions', (req, res) => {
  res.json({
    success: true,
    data: {
      transactions: [
        {
          id: 'tx-1',
          user_id: 'mock-user-id',
          type: 'contest_prize',
          amount: 5000.00,
          description: 'Won Photo Contest',
          status: 'completed',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'tx-2',
          user_id: 'mock-user-id',
          type: 'deposit',
          amount: 10000.00,
          description: 'Wallet Deposit',
          status: 'completed',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  });
});

app.get('/api/wallets/balance', (req, res) => {
  res.json({
    success: true,
    data: {
      balance: 75000.00,
      currency: 'NGN',
      is_active: true
    }
  });
});

// Mock user entries endpoint
app.get('/api/contests/entries', (req, res) => {
  res.json({
    success: true,
    data: {
      entries: [
        {
          id: 'entry-1',
          contest_id: 'mock-contest-1',
          creator_id: 'mock-user-id',
          creator_name: 'Demo Creator',
          post_url: 'https://instagram.com/p/demo123',
          status: 'submitted',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Contest Platform Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Note: This is a mock server without database connection`);
});

export default app;