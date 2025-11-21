import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { Wallet } from '../models/Wallet';
import { UserType } from '../types';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 }),
  body('user_type').isIn(Object.values(UserType)),
  body('first_name').trim().escape(),
  body('last_name').trim().escape()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, username, password, user_type, first_name, last_name } = req.body;

    // Check if user already exists
    const existingUser = await AppDataSource.getRepository(User).findOne({
      where: [
        { email },
        { username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User();
    user.email = email;
    user.username = username;
    user.password = hashedPassword;
    user.user_type = user_type;

    const savedUser = await AppDataSource.getRepository(User).save(user);

    // Create user profile
    const profile = new UserProfile();
    profile.user_id = savedUser.id;
    profile.first_name = first_name;
    profile.last_name = last_name;
    await AppDataSource.getRepository(UserProfile).save(profile);

    // Create wallet
    const wallet = new Wallet();
    wallet.user_id = savedUser.id;
    wallet.balance = 0;
    wallet.currency = 'USD';
    await AppDataSource.getRepository(Wallet).save(wallet);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: savedUser.id,
        email: savedUser.email,
        user_type: savedUser.user_type
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          username: savedUser.username,
          user_type: savedUser.user_type,
          is_verified: savedUser.is_verified,
          is_active: savedUser.is_active
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await AppDataSource.getRepository(User).findOne({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        user_type: user.user_type
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          user_type: user.user_type,
          is_verified: user.is_verified,
          is_active: user.is_active
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.user.id },
      relations: ['profile.social_accounts', 'wallet']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          user_type: user.user_type,
          is_verified: user.is_verified,
          is_active: user.is_active,
          profile: user.profile,
          wallet: user.wallet
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

export default router;