import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import contestRoutes from './routes/contest';
import walletRoutes from './routes/wallet';
import socialMediaRoutes from './routes/socialMedia';
import adminRoutes from './routes/admin';
import supportRoutes from './routes/support';
import uploadRoutes from './routes/upload';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Import database initialization
import { initializeDatabase } from './config/database';

// Load environment variables
dotenv.config();

const app = express();

// Build CORS allowlist
const defaultOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'http://27475b93ac2d.ngrok-free.app',
  'https://27475b93ac2d.ngrok-free.app',
];
const envOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : [])
].filter(Boolean) as string[];
const ALLOWED_ORIGINS = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration with allowlist
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser or same-origin
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
// app.use(limiter);

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
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/wallets', walletRoutes); // compatibility alias
app.use('/api/wallets', walletRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/upload', uploadRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-contest', (contestId) => {
    socket.join(`contest-${contestId}`);
    console.log(`User ${socket.id} joined contest ${contestId}`);
  });
  
  socket.on('leave-contest', (contestId) => {
    socket.leave(`contest-${contestId}`);
    console.log(`User ${socket.id} left contest ${contestId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;